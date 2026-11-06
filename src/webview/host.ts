import { parseHostMessage, type HostToWebviewMessage, type WebviewToHostMessage } from '../shared/messages';

/** The small API VS Code injects into a webview. It can be acquired only once per page. */
interface VsCodeApi {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

export interface HostConnection {
  /** `vscode` inside the extension; `browser` when the page runs on its own (Vite preview, a future standalone build). */
  readonly kind: 'vscode' | 'browser';
  send(message: WebviewToHostMessage): void;
  onMessage(listener: (message: HostToWebviewMessage) => void): () => void;
}

/** Connects to whatever is hosting the page. The game itself never needs to know which. */
export function connectToHost(): HostConnection {
  if (typeof acquireVsCodeApi === 'function') {
    const api = acquireVsCodeApi();
    return {
      kind: 'vscode',
      send: (message) => api.postMessage(message),
      onMessage: (listener) => {
        const handler = (event: MessageEvent): void => {
          const message = parseHostMessage(event.data);
          if (message !== undefined) listener(message);
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
      },
    };
  }
  return {
    kind: 'browser',
    send: () => undefined,
    onMessage: () => () => undefined,
  };
}
