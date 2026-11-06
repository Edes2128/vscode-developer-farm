import { stepZoom } from '../../rendering/viewport';
import { useUi, useUiActions } from '../store';

const VOLUMES = [
  ['master', 'Volume'],
  ['sfx', 'Effects'],
  ['ambient', 'Ambience'],
  ['music', 'Music'],
] as const;

/** The pause menu: wooden panel, real controls only. */
export function PauseMenu() {
  const open = useUi((s) => s.menuOpen);
  const zoomLevel = useUi((s) => s.zoomLevel);
  const zoomPreference = useUi((s) => s.zoomPreference);
  const keys = useUi((s) => s.keys);
  const saveKind = useUi((s) => s.saveStatus.kind);
  const hintsVisible = useUi((s) => s.hintsVisible);
  const audio = useUi((s) => s.audio);
  const textSize = useUi((s) => s.textSize);
  const highContrast = useUi((s) => s.highContrast);
  const motion = useUi((s) => s.motion);
  const { resume, saveGame, setZoom, showHints, dismissHints, toggleHud, openJournal, setAudio, setAccessibility } = useUiActions();
  if (!open) return null;

  return (
    <div className="df-menu-backdrop" onClick={resume}>
      <div className="df-menu df-panel-wood" role="dialog" aria-label="Paused" onClick={(event) => event.stopPropagation()}>
        <h1 className="df-menu-title">Paused</h1>

        <button className="df-button df-button-wide" type="button" onClick={resume} autoFocus>
          Back to the farm
        </button>
        <button className="df-button df-button-wide" type="button" onClick={openJournal}>
          Journal ({keys['journal']})
        </button>
        <button className="df-button df-button-wide" type="button" onClick={saveGame} disabled={saveKind === 'saving'}>
          {saveKind === 'saving' ? 'Saving…' : 'Save game'}
        </button>

        <div className="df-menu-row">
          <span>Zoom</span>
          <div className="df-stepper">
            <button className="df-button df-button-small" type="button" aria-label="Zoom out" onClick={() => setZoom(stepZoom(zoomLevel, -1) as 1 | 2 | 3 | 4 | 5 | 6)}>
              −
            </button>
            <span className="df-stepper-value">{zoomPreference === 'auto' ? `Auto (${zoomLevel}×)` : `${zoomLevel}×`}</span>
            <button className="df-button df-button-small" type="button" aria-label="Zoom in" onClick={() => setZoom(stepZoom(zoomLevel, 1) as 1 | 2 | 3 | 4 | 5 | 6)}>
              +
            </button>
            <button className="df-button df-button-small" type="button" aria-pressed={zoomPreference === 'auto'} onClick={() => setZoom('auto')}>
              Auto
            </button>
          </div>
        </div>

        <div className="df-menu-row">
          <span>Hints</span>
          <button className="df-button df-button-small" type="button" onClick={hintsVisible ? dismissHints : showHints}>
            {hintsVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="df-menu-row">
          <span>Interface</span>
          <button className="df-button df-button-small" type="button" onClick={toggleHud}>
            Hide ({keys['hud']})
          </button>
        </div>

        <h2 className="df-menu-section">Sound</h2>
        <div className="df-menu-row">
          <span>Sound</span>
          <button className="df-button df-button-small" type="button" aria-label={`Sound: ${audio.muted ? 'muted' : 'on'}`} onClick={() => setAudio({ muted: !audio.muted })}>
            {audio.muted ? 'Muted' : 'On'}
          </button>
        </div>
        {VOLUMES.map(([key, label]) => (
          <label className="df-menu-row df-slider" key={key}>
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(audio[key] * 100)}
              disabled={audio.muted}
              aria-label={label}
              aria-valuetext={`${Math.round(audio[key] * 100)} percent`}
              onChange={(event) => setAudio({ [key]: Number(event.target.value) / 100 })}
            />
            <span className="df-slider-value" aria-hidden="true">
              {Math.round(audio[key] * 100)}
            </span>
          </label>
        ))}

        <h2 className="df-menu-section">Comfort</h2>
        <div className="df-menu-row">
          <span>Text</span>
          <button className="df-button df-button-small" type="button" aria-label={`Text size: ${textSize}`} onClick={() => setAccessibility({ textSize: textSize === 'large' ? 'normal' : 'large' })}>
            {textSize === 'large' ? 'Large' : 'Normal'}
          </button>
        </div>
        <div className="df-menu-row">
          <span>Contrast</span>
          <button className="df-button df-button-small" type="button" aria-label={`Contrast: ${highContrast ? 'high' : 'normal'}`} onClick={() => setAccessibility({ highContrast: !highContrast })}>
            {highContrast ? 'High' : 'Normal'}
          </button>
        </div>
        <div className="df-menu-row">
          <span>Motion</span>
          <button
            className="df-button df-button-small"
            type="button"
            title="Rain, flashes, bobbing and sparkles. System follows your computer's reduced-motion setting."
            onClick={() => setAccessibility({ motion: motion === 'system' ? 'reduced' : motion === 'reduced' ? 'full' : 'system' })}
          >
            {motion === 'system' ? 'System' : motion === 'reduced' ? 'Calm' : 'Full'}
          </button>
        </div>

        <p className="df-menu-foot">
          Saves on this computer only. {keys['menu']} to close.
        </p>
      </div>
    </div>
  );
}
