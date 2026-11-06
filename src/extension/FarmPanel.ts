import * as vscode from 'vscode';
import { assetMode, resolveAssetSource } from './assetSource';
import type { FarmHost } from './FarmHost';
import type { Logger } from './logger';
import { getWebviewOptions, renderWebviewHtml } from './webviewHtml';

/** The farm in an editor tab. Only one exists at a time: opening it again brings the same tab forward. */
export class FarmPanel {
  static readonly viewType = 'developerFarm.panel';

  private static current: FarmPanel | undefined;

  static isOpen(): boolean {
    return FarmPanel.current !== undefined;
  }

  static close(): void {
    FarmPanel.current?.panel.dispose();
  }

  static async createOrShow(context: vscode.ExtensionContext, host: FarmHost, logger: Logger): Promise<void> {
    if (FarmPanel.current) {
      FarmPanel.current.panel.reveal();
      return;
    }

    const { extensionUri } = context;
    const panel = vscode.window.createWebviewPanel(FarmPanel.viewType, 'Developer Farm', vscode.ViewColumn.Active, {
      ...getWebviewOptions(extensionUri),
      // Keep the game alive when its tab is in the background: no reload, no lost state. It pauses itself.
      retainContextWhenHidden: true,
    });
    // A coloured image: a tab draws its icon as-is, so a `currentColor` glyph (media/farm.svg) would vanish on a dark theme.
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'farm-tab.png');

    const instance = new FarmPanel(panel);
    FarmPanel.current = instance;
    panel.onDidDispose(() => {
      instance.attachment?.dispose();
      FarmPanel.current = undefined;
    });

    const source = await resolveAssetSource(context, logger);
    if (FarmPanel.current !== instance) return; // closed while the dev server was being probed

    instance.attachment = host.attach(panel.webview, assetMode(source));
    panel.webview.html = renderWebviewHtml(panel.webview, extensionUri, source);
  }

  private attachment: vscode.Disposable | undefined;

  private constructor(private readonly panel: vscode.WebviewPanel) {}
}
