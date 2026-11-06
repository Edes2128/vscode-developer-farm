import { useEffect, useRef, useState } from 'react';
import { frameStyle } from '../atlasImage';
import { useUi, useUiActions, type SpeakerView } from '../store';

/** A ribbon at the top of the screen on a festival day: what is on, and how you are doing at it. */
export function FestivalRibbon() {
  const note = useUi((s) => s.festivalNote);
  const hidden = useUi((s) => s.dialog !== undefined || s.menuOpen || s.journalOpen || s.focusLost);
  if (note === '' || hidden) return null;
  return (
    <div className="df-festival df-panel-parchment" role="status">
      <span className="df-festival-mark" aria-hidden="true">✿</span>
      <span>{note}</span>
    </div>
  );
}

/** The frame around the view: dark forest green with golden studs. Purely decorative. */
export function Frame() {
  return <div className="df-frame" aria-hidden="true" />;
}

/** "Willowbrook Valley / Home Farm", shown for a few seconds whenever the player arrives somewhere. */
export function LocationBanner() {
  const key = useUi((s) => s.bannerKey);
  const name = useUi((s) => s.locationName);
  const region = useUi((s) => s.regionName);
  if (key === 0 || name === '') return null;
  return (
    <div className="df-banner df-panel-wood" key={key} role="status">
      <span className="df-banner-region">{region}</span>
      <span className="df-banner-name">{name}</span>
    </div>
  );
}

/** What the player can do right now, right where they are looking. */
export function InteractionPrompt() {
  const prompt = useUi((s) => s.prompt);
  const key = useUi((s) => s.keys['interactPrimary']);
  const hidden = useUi((s) => s.dialog !== undefined || s.menuOpen || s.focusLost);
  if (prompt === undefined || hidden) return null;
  return (
    <div className="df-prompt df-panel-parchment" role="status">
      <kbd className="df-key">{key}</kbd>
      <span>
        {prompt.verb} <strong>{prompt.name}</strong>
      </span>
    </div>
  );
}

/** A message from the world: a sign, a door, a stall. Click or press the interact key to go on; choices are picked with the arrows. */
export function DialogBox() {
  const dialog = useUi((s) => s.dialog);
  const key = useUi((s) => s.keys['interactPrimary']);
  const { advanceDialog, chooseOption } = useUiActions();
  const list = useRef<HTMLUListElement>(null);
  const selected = dialog?.selected;
  // A long menu (the kitchen) scrolls: keep the highlighted choice in view as the arrows move it.
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected, dialog?.page]);
  if (dialog === undefined) return null;
  const last = dialog.page + 1 >= dialog.pages;
  const choosing = last && dialog.options.length > 0;
  return (
    <div
      className="df-dialog df-panel-parchment"
      role="dialog"
      aria-label={dialog.title}
      onClick={choosing ? undefined : advanceDialog}
      key={`${dialog.title}:${choosing ? 'choices' : dialog.page}`}
    >
      <div className={dialog.speaker === undefined ? 'df-dialog-body' : 'df-dialog-body df-dialog-spoken'}>
        {dialog.speaker === undefined ? null : <Portrait speaker={dialog.speaker} />}
        <div className="df-dialog-content">
          <div className="df-dialog-title">
            {dialog.title}
            {dialog.speaker === undefined ? null : <span className="df-dialog-role"> · {dialog.speaker.role}</span>}
          </div>
          <p className="df-dialog-text">{dialog.text}</p>
        </div>
      </div>
      {choosing ? (
        <>
          <ul className="df-options" role="listbox" aria-label="Choices" ref={list}>
            {dialog.options.map((option, index) => (
              <li key={index} role="option" aria-selected={index === dialog.selected} aria-disabled={!option.enabled}>
                <button
                  type="button"
                  className={index === dialog.selected ? 'df-option df-option-selected' : 'df-option'}
                  disabled={!option.enabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseOption(index);
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
          {dialog.note === undefined ? null : <p className="df-dialog-note">{dialog.note}</p>}
          <div className="df-dialog-more">
            <kbd className="df-key">↑↓</kbd>
            <span>Choose</span>
            <kbd className="df-key">{key}</kbd>
            <span>Select</span>
          </div>
        </>
      ) : (
        <div className="df-dialog-more">
          <kbd className="df-key">{key}</kbd>
          <span>{last ? 'Close' : 'Next'}</span>
        </div>
      )}
    </div>
  );
}

/** A villager's face and how fond of the player they are, ten hearts. */
function Portrait({ speaker }: { readonly speaker: SpeakerView }) {
  return (
    <div className="df-portrait">
      <div className="df-portrait-art" style={frameStyle(speaker.portrait, 'var(--px)')} aria-hidden="true" />
      <div className="df-hearts" role="img" aria-label={`${speaker.hearts} of 10 hearts`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < speaker.hearts ? 'df-heart df-heart-full' : 'df-heart'} aria-hidden="true">
            ♥
          </span>
        ))}
      </div>
    </div>
  );
}

/** How to play, for new players. Dismissed for good with one click. */
export function HintsPanel() {
  const visible = useUi((s) => s.hintsVisible);
  const keys = useUi((s) => s.keys);
  const { dismissHints } = useUiActions();
  if (!visible) return null;
  const rows: readonly (readonly [string, string])[] = [
    ['Move', keys['move'] ?? ''],
    ['Run', keys['run'] ?? ''],
    ['Use item', keys['use'] ?? ''],
    ['Look, pick', keys['interact'] ?? ''],
    ['Choose item', keys['hotbar'] ?? ''],
    ['Journal', keys['journal'] ?? ''],
    ['Menu', keys['menu'] ?? ''],
    ['Zoom', keys['zoom'] ?? ''],
    ['Hide HUD', keys['hud'] ?? ''],
  ];
  return (
    <aside className="df-hints df-panel-parchment" aria-label="How to play">
      <div className="df-hints-head">
        <span className="df-hints-title">How to play</span>
        <button className="df-hints-close" type="button" onClick={dismissHints} aria-label="Dismiss the hints" title="Dismiss (you can bring them back from the menu)">
          ×
        </button>
      </div>
      <dl>
        {rows.map(([what, how]) => (
          <div className="df-hints-row" key={what}>
            <dt>{what}</dt>
            <dd>
              <kbd className="df-key">{how}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** Save feedback: a quiet "Saved" that fades, or a plain warning if saving fails. */
export function SaveToast() {
  const status = useUi((s) => s.saveStatus);
  const [shownAt, setShownAt] = useState(0);
  useEffect(() => {
    if (status.kind === 'saved') setShownAt(status.at);
  }, [status]);
  if (status.kind === 'saved') {
    return (
      <div className="df-toast df-panel-wood" key={shownAt} role="status">
        Game saved
      </div>
    );
  }
  if (status.kind === 'failed') {
    return (
      <div className="df-toast df-toast-warning df-panel-wood" role="alert">
        Could not save. Your progress is safe until you close the game.
      </div>
    );
  }
  return null;
}

/** Something the player should know, and can dismiss. */
export function Notice() {
  const notice = useUi((s) => s.notice);
  const { dismissNotice } = useUiActions();
  if (notice === undefined) return null;
  return (
    <div className="df-notice df-panel-parchment" role="alert">
      <p>{notice}</p>
      <button className="df-button" type="button" onClick={dismissNotice}>
        OK
      </button>
    </div>
  );
}

/** Shown when the window loses focus: the game has paused itself, and a click brings it back. */
export function FocusOverlay() {
  const lost = useUi((s) => s.focusLost);
  const menuOpen = useUi((s) => s.menuOpen);
  const { focusGame } = useUiActions();
  if (!lost || menuOpen) return null;
  return (
    <button className="df-focus" type="button" onClick={focusGame}>
      <span className="df-panel-wood">Paused. Click to play.</span>
    </button>
  );
}

/** A developer overlay (F3): frame rate, position, and how much is being drawn. */
export function DebugOverlay() {
  const visible = useUi((s) => s.debugVisible);
  const info = useUi((s) => s.debug);
  if (!visible || info === undefined) return null;
  return (
    <pre className="df-debug" aria-label="Debug information">
      {[
        `${info.fps.toFixed(0)} fps   ${info.backend}   zoom ${info.zoom}x @${info.pixelRatio}`,
        `${info.map}`,
        `pos ${info.x.toFixed(1)}, ${info.y.toFixed(1)}   cell ${info.tileX}, ${info.tileY}   facing ${info.facing}`,
        `chunks ${info.visibleChunks} in view / ${info.builtChunks} built   objects ${info.visibleObjects}`,
        `played ${info.playTime}`,
      ].join('\n')}
    </pre>
  );
}

/** Shown while the world loads, and when it could not. */
export function StatusScreen() {
  const status = useUi((s) => s.status);
  const error = useUi((s) => s.error);
  if (status === 'ready') return null;
  return (
    <div className="df-status" role={status === 'error' ? 'alert' : 'status'}>
      <div className="df-panel-parchment df-status-box">
        <div className="df-status-title">{status === 'error' ? 'The farm could not open' : 'Opening the farm…'}</div>
        {status === 'error' ? <p className="df-status-text">{error}</p> : null}
      </div>
    </div>
  );
}
