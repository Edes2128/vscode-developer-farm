import * as path from 'node:path';
import * as vscode from 'vscode';
import type { TestState } from '../shared/messages';
import { FarmHomeView } from './FarmHomeView';
import { FarmHost, type WebviewDiagnostics } from './FarmHost';
import { FarmPanel } from './FarmPanel';
import { Logger } from './logger';
import { FileSaveStore } from './saveStore';

/** Only returned from `activate` in test mode, so integration tests can drive and inspect the real extension. */
export interface FarmTestApi {
  /** What the open game's webview has reported, or undefined if none is open. */
  diagnostics(): WebviewDiagnostics | undefined;
  /** Folder the saves are written to. */
  readonly saveDirectory: string;
  open(): Promise<void>;
  close(): void;
  isOpen(): boolean;
  pressKeys(codes: readonly string[], holdMs: number): void;
  saveNow(): void;
  sleep(): void;
  dismissSummary(): void;
  probe(): Promise<TestState>;
}

export function activate(context: vscode.ExtensionContext): FarmTestApi | undefined {
  const started = performance.now();
  const logger = new Logger();
  const version = readVersion(context);
  const testing = __DEV_TOOLS__ && context.extensionMode === vscode.ExtensionMode.Test;

  // Saves are plain files in the extension's global storage: on this computer, readable, never uploaded.
  const saveDirectory = path.join(context.globalStorageUri.fsPath, 'saves');
  const storage = new FileSaveStore(saveDirectory);
  const host = new FarmHost(logger, storage, version, testing);

  context.subscriptions.push(
    logger,
    vscode.window.registerTreeDataProvider(FarmHomeView.viewId, new FarmHomeView()),
    vscode.commands.registerCommand('developerFarm.open', () => FarmPanel.createOrShow(context, host, logger)),
  );

  logger.info(`Developer Farm ${version} activated in ${Math.round(performance.now() - started)} ms (saves: ${saveDirectory})`);

  // The test API reaches into the running game, so it must never exist for an installed extension. In the
  // packaged extension this code is not even compiled in (`__DEV_TOOLS__` is false there).
  return testing
    ? {
        diagnostics: () => host.diagnostics,
        saveDirectory,
        open: () => FarmPanel.createOrShow(context, host, logger),
        close: () => FarmPanel.close(),
        isOpen: () => FarmPanel.isOpen(),
        pressKeys: (codes, holdMs) => host.pressKeys(codes, holdMs),
        saveNow: () => host.saveNow(),
        sleep: () => host.sleep(),
        dismissSummary: () => host.dismissSummary(),
        probe: () => host.probe(),
      }
    : undefined;
}

export function deactivate(): void {
  // Nothing to flush here: the webview saves through the host as it goes, and each write is complete before
  // it is acknowledged.
}

function readVersion(context: vscode.ExtensionContext): string {
  const { version } = context.extension.packageJSON as { version?: unknown };
  return typeof version === 'string' ? version : '0.0.0';
}
