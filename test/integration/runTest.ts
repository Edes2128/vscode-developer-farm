/**
 * Launches the installed VS Code with this extension loaded and runs `suite/index.ts` inside it.
 *
 *   npm run test:integration
 *
 * Runs use a throwaway profile under .vscode-test/, so the player's own VS Code settings, extensions and
 * saved farm are never touched. Set VSCODE_EXECUTABLE_PATH to use a different VS Code; without an installed
 * one @vscode/test-electron downloads a stable build.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

const INSTALLED_VSCODE_MACOS = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const sandbox = path.join(projectRoot, '.vscode-test');
  const workspace = path.join(sandbox, 'workspace');

  // Short names: VS Code puts its IPC socket in the user-data dir and macOS limits socket paths to ~100 characters.
  fs.rmSync(path.join(sandbox, 'ud'), { recursive: true, force: true });
  fs.rmSync(path.join(sandbox, 'ext'), { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const vscodeExecutablePath = process.env['VSCODE_EXECUTABLE_PATH'] ?? (fs.existsSync(INSTALLED_VSCODE_MACOS) ? INSTALLED_VSCODE_MACOS : undefined);

  // If this process was started from an Electron app, the flag would make VS Code behave like plain Node.
  delete process.env['ELECTRON_RUN_AS_NODE'];

  await runTests({
    ...(vscodeExecutablePath === undefined ? {} : { vscodeExecutablePath }),
    extensionDevelopmentPath: projectRoot,
    extensionTestsPath: path.join(__dirname, 'suite', 'index.js'),
    launchArgs: [
      workspace,
      '--disable-extensions',
      `--user-data-dir=${path.join(sandbox, 'ud')}`,
      `--extensions-dir=${path.join(sandbox, 'ext')}`,
      // The game draws with requestAnimationFrame, which a window that another window covers never receives.
      // Without these the suite would pass or fail depending on what else is on the screen.
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-updates',
    ],
  });
}

main().catch((error: unknown) => {
  console.error('Integration tests failed:', error);
  process.exit(1);
});
