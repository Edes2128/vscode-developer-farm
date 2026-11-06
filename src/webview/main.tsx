import { createRoot } from 'react-dom/client';
import '../ui/styles/pixel.css';
import '../ui/styles/hud.css';
import { App } from '../ui/App';
import { installDiagnostics } from './diagnostics';
import { connectToHost } from './host';
import { createSession } from './session';

const host = connectToHost();
installDiagnostics(host);

const gameElement = document.getElementById('game');
const uiElement = document.getElementById('ui');
if (gameElement === null || uiElement === null) {
  throw new Error('Developer Farm webview: missing #game or #ui element');
}

const session = createSession({ host, gameElement });
createRoot(uiElement).render(<App value={{ store: session.store, actions: session.actions }} />);

// Lets a developer poke at the running game from the browser console when the page runs on its own.
if (import.meta.env.DEV && host.kind === 'browser') {
  (window as unknown as { farm: unknown }).farm = session;
}
