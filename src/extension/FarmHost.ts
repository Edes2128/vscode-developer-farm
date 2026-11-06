import * as vscode from 'vscode';
import type { StorageBackend } from '../engine/persistence/storage';
import {
  parseWebviewMessage,
  type AssetMode,
  type HostToWebviewMessage,
  type TestState,
  type WebviewToHostMessage,
} from '../shared/messages';
import type { Logger } from './logger';

/** What a webview has reported about itself. Surfaced to the log and to integration tests. */
export interface WebviewDiagnostics {
  assetMode: AssetMode;
  readyCount: number;
  rendered: boolean;
  renderer: string | undefined;
  mapId: string | undefined;
  fontsLoaded: boolean | undefined;
  readonly cspViolations: string[];
  readonly errors: string[];
}

/**
 * The extension side of the game's webview.
 *
 * The game runs entirely in the webview; the host only keeps files for it and keeps a log. Every message from
 * the webview is untrusted: it is validated here, and storage keys are restricted to a safe pattern.
 */
export class FarmHost {
  private webview: vscode.Webview | undefined;
  private diagnosticsValue: WebviewDiagnostics | undefined;
  private nextProbe = 1;
  private readonly probes = new Map<number, (state: TestState) => void>();

  constructor(
    private readonly logger: Logger,
    private readonly storage: StorageBackend,
    private readonly extensionVersion: string,
    private readonly testMode: boolean,
  ) {}

  get diagnostics(): WebviewDiagnostics | undefined {
    return this.diagnosticsValue;
  }

  /** Starts routing messages for `webview`. Dispose the result when the webview goes away. */
  attach(webview: vscode.Webview, assetMode: AssetMode): vscode.Disposable {
    this.webview = webview;
    this.diagnosticsValue = {
      assetMode,
      readyCount: 0,
      rendered: false,
      renderer: undefined,
      mapId: undefined,
      fontsLoaded: undefined,
      cspViolations: [],
      errors: [],
    };
    const subscription = webview.onDidReceiveMessage((raw: unknown) => this.receive(webview, raw));
    return new vscode.Disposable(() => {
      subscription.dispose();
      if (this.webview === webview) this.webview = undefined;
    });
  }

  /** Test builds only: presses keys in the game and releases them after `holdMs`. */
  pressKeys(codes: readonly string[], holdMs: number): void {
    this.post({ type: 'testKeys', codes, holdMs });
  }

  /** Test builds only: saves now. */
  saveNow(): void {
    this.post({ type: 'testSave' });
  }

  /** Test builds only: goes to bed. */
  sleep(): void {
    this.post({ type: 'testSleep' });
  }

  /** Test builds only: closes the morning report. */
  dismissSummary(): void {
    this.post({ type: 'testDismiss' });
  }

  /** Test builds only: asks the game where it is. */
  probe(timeoutMs = 5000): Promise<TestState> {
    const id = this.nextProbe++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.probes.delete(id);
        reject(new Error('The game did not answer a probe'));
      }, timeoutMs);
      this.probes.set(id, (state) => {
        clearTimeout(timer);
        resolve(state);
      });
      this.post({ type: 'testProbe', id });
    });
  }

  private receive(webview: vscode.Webview, raw: unknown): void {
    const message = parseWebviewMessage(raw);
    if (message === undefined) {
      this.logger.warn('Ignored a malformed message from the game');
      return;
    }
    void this.handle(webview, message);
  }

  private async handle(webview: vscode.Webview, message: WebviewToHostMessage): Promise<void> {
    const diagnostics = this.diagnosticsValue;
    switch (message.type) {
      case 'ready':
        if (diagnostics !== undefined) diagnostics.readyCount += 1;
        this.postTo(webview, {
          type: 'init',
          payload: { extensionVersion: this.extensionVersion, assetMode: diagnostics?.assetMode ?? 'prod', testMode: this.testMode },
        });
        break;
      case 'storageRead':
        await this.answer(webview, message.id, () => this.storage.read(message.key));
        break;
      case 'storageWrite':
        await this.answer(webview, message.id, async () => {
          await this.storage.write(message.key, message.text);
          return null;
        });
        break;
      case 'storageRemove':
        await this.answer(webview, message.id, async () => {
          await this.storage.remove(message.key);
          return null;
        });
        break;
      case 'rendered':
        if (diagnostics !== undefined) {
          diagnostics.rendered = true;
          diagnostics.renderer = message.renderer;
          diagnostics.mapId = message.mapId;
          diagnostics.fontsLoaded = message.fontsLoaded;
        }
        this.logger.info(`The farm opened on ${message.mapId} (renderer: ${message.renderer}, fonts loaded: ${message.fontsLoaded})`);
        break;
      case 'cspViolation':
        diagnostics?.cspViolations.push(`${message.directive}: ${message.blockedUri}`);
        this.logger.warn(`Content security policy: ${message.directive} blocked ${message.blockedUri}`);
        break;
      case 'error':
        diagnostics?.errors.push(message.message);
        this.logger.error(`Game error: ${message.message}`);
        break;
      case 'testState': {
        if (!this.testMode) break; // never answers a probe outside test builds
        const resolve = this.probes.get(message.id);
        this.probes.delete(message.id);
        resolve?.(message.state);
        break;
      }
    }
  }

  /** Runs a storage operation and sends its result back. A failure becomes an error reply, never an exception. */
  private async answer(webview: vscode.Webview, id: number, operation: () => Promise<string | null>): Promise<void> {
    try {
      const text = await operation();
      this.postTo(webview, { type: 'storageResult', id, ok: true, text });
    } catch (error) {
      this.logger.error('A storage request failed', error);
      this.postTo(webview, { type: 'storageResult', id, ok: false, text: null, error: 'The extension could not read or write the file' });
    }
  }

  private post(message: HostToWebviewMessage): void {
    if (this.webview !== undefined) this.postTo(this.webview, message);
  }

  private postTo(webview: vscode.Webview, message: HostToWebviewMessage): void {
    webview.postMessage(message).then(undefined, (error: unknown) => {
      this.logger.error(`Failed to post "${message.type}"`, error);
    });
  }
}
