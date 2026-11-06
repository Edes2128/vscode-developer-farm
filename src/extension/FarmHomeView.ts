import * as vscode from 'vscode';

/**
 * The Activity Bar entry. It has no items of its own: its welcome message (declared in package.json)
 * holds the "Open Developer Farm" button. An empty provider is what makes VS Code show that message.
 */
export class FarmHomeView implements vscode.TreeDataProvider<never> {
  static readonly viewId = 'developerFarm.home';

  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }

  getChildren(): never[] {
    return [];
  }
}
