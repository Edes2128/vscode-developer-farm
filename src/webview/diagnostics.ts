import type { HostConnection } from './host';

/**
 * Reports problems inside the webview to the extension host's log, where the player or a developer can
 * find them (Output > Developer Farm). Nothing here leaves the computer.
 */
export function installDiagnostics(host: HostConnection): void {
  const report = (message: string): void => {
    host.send({ type: 'error', message: message.slice(0, 400) });
    if (host.kind === 'browser') console.error(message);
  };

  window.addEventListener('error', (event) => {
    report(`${event.message} (${event.filename}:${event.lineno})`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    report(`Unhandled promise rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`);
  });
  document.addEventListener('securitypolicyviolation', (event) => {
    host.send({ type: 'cspViolation', directive: event.violatedDirective.slice(0, 200), blockedUri: event.blockedURI.slice(0, 200) });
  });
}
