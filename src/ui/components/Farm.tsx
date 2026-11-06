import { frameStyle } from '../atlasImage';
import { useUi, useUiActions, type SlotView } from '../store';

/** The row of pockets along the bottom: click a slot, press its number, or use the wheel. */
export function Hotbar() {
  const slots = useUi((s) => s.hotbar);
  const selected = useUi((s) => s.selectedSlot);
  const hidden = useUi((s) => s.dialog !== undefined);
  const { selectSlot } = useUiActions();
  if (hidden || slots.length === 0) return null;
  const current = slots[selected];
  return (
    <div className="df-hotbar-wrap">
      <div className="df-hotbar-name">{current === undefined || current.empty ? '' : current.name}</div>
      <div className="df-hotbar" role="toolbar" aria-label="Items">
        {slots.map((slot, index) => (
          <Slot key={index} slot={slot} index={index} selected={index === selected} onSelect={selectSlot} />
        ))}
      </div>
    </div>
  );
}

function Slot({ slot, index, selected, onSelect }: { slot: SlotView; index: number; selected: boolean; onSelect: (index: number) => void }) {
  const label = index < 9 ? String(index + 1) : index === 9 ? '0' : '';
  return (
    <button
      type="button"
      className={selected ? 'df-slot df-slot-selected' : 'df-slot'}
      aria-label={slot.empty ? `Slot ${label || index + 1}, empty` : `${slot.name}${slot.count > 1 ? `, ${slot.count}` : ''}`}
      aria-pressed={selected}
      title={slot.empty ? undefined : `${slot.name}: ${slot.description}`}
      onClick={() => onSelect(index)}
    >
      {slot.icon === undefined ? null : <span className="df-icon" style={frameStyle(slot.icon, 'var(--hb)')} />}
      {label === '' ? null : <span className="df-slot-key">{label}</span>}
      {slot.count > 1 ? <span className="df-slot-count">{slot.count}</span> : null}
      {slot.quality > 0 ? <span className={slot.quality > 1 ? 'df-slot-star df-slot-star-2' : 'df-slot-star'}>{slot.quality > 1 ? '★★' : '★'}</span> : null}
      {slot.meter === undefined ? null : (
        <span className="df-slot-meter" aria-hidden="true">
          <span className="df-slot-meter-fill" style={{ width: `${Math.round(slot.meter * 100)}%` }} />
        </span>
      )}
    </button>
  );
}

/** Day, time and money, top right. */
export function StatusPanel() {
  const date = useUi((s) => s.dateLabel);
  const weekday = useUi((s) => s.weekday);
  const time = useUi((s) => s.timeLabel);
  const money = useUi((s) => s.money);
  const season = useUi((s) => s.season);
  const weather = useUi((s) => s.weather);
  if (date === '') return null;
  return (
    <div className={`df-status-panel df-panel-wood df-season-${season}`} aria-label="Date, time and money">
      <div className="df-status-date">
        {date} <span className="df-status-weekday">{weekday}</span>
      </div>
      <div className="df-status-time">{time}</div>
      {weather === undefined ? null : (
        <div className="df-status-weather" title={`Tomorrow: ${weather.forecastName}`} aria-label={`Weather: ${weather.name}. Tomorrow: ${weather.forecastName}.`}>
          <span>{weather.name}</span>
          <span className="df-weather-icon" style={frameStyle(`icon/weather_${weather.key}`, 'var(--px)')} aria-hidden="true" />
          <span className="df-weather-next" aria-hidden="true">
            then
            <span className="df-weather-icon df-weather-icon-small" style={frameStyle(`icon/weather_${weather.forecastKey}`, 'calc(var(--px) * 0.75)')} />
          </span>
        </div>
      )}
      <div className="df-status-money">
        <span className="df-coin" style={frameStyle('icon/coin', 'var(--px)')} aria-hidden="true" />
        <span>{money.toLocaleString('en-US')}g</span>
      </div>
    </div>
  );
}

/** A line that appears over the hotbar for a moment: what you picked up, or why something did not work. */
export function FloatingHint() {
  const hint = useUi((s) => s.hint);
  if (hint === undefined) return null;
  return (
    <div className={hint.tone === 'warn' ? 'df-hint df-hint-warn df-panel-parchment' : 'df-hint df-panel-parchment'} key={hint.key} role="status">
      {hint.text}
    </div>
  );
}

/** The morning after: what was sold, and how the crops did. */
export function SummaryScreen() {
  const summary = useUi((s) => s.summary);
  const fade = useUi((s) => s.fadeKey);
  const travel = useUi((s) => s.travelKey);
  const key = useUi((s) => s.keys['interactPrimary']);
  const { dismissSummary } = useUiActions();
  return (
    <>
      {fade > 0 ? <div className="df-fade" key={fade} aria-hidden="true" /> : null}
      {travel > 0 ? <div className="df-fade df-fade-quick" key={`t${travel}`} aria-hidden="true" /> : null}
      {summary === undefined ? null : (
        <div className="df-summary-backdrop">
          <div className="df-summary df-panel-parchment" role="dialog" aria-label="Morning report">
            <div className="df-summary-date">{summary.date}</div>
            <p className="df-summary-intro">
              {summary.cause === 'slept' ? 'You slept soundly, and the farm carried on without you.' : 'You stayed out far too late and nodded off where you stood. You woke up at home.'}
            </p>
            {summary.shipped.length > 0 ? (
              <ul className="df-summary-list">
                {summary.shipped.map((line) => (
                  <li key={`${line.name}:${line.quality}`}>
                    <span>
                      {line.count} × {line.name}
                      {line.quality > 0 ? (line.quality > 1 ? ' ★★' : ' ★') : ''}
                    </span>
                    <span>{line.total}g</span>
                  </li>
                ))}
                <li className="df-summary-total">
                  <span>Sold</span>
                  <span>{summary.earned}g</span>
                </li>
              </ul>
            ) : null}
            <p className="df-summary-crops">
              {summary.weatherKey === 'rain' || summary.weatherKey === 'storm' ? `It ${summary.weatherKey === 'storm' ? 'stormed' : 'rained'} in the night: the fields are watered. ` : ''}
              Today: {summary.weather.toLowerCase()}. Tomorrow: {summary.forecast.toLowerCase()}.
            </p>
            {summary.festivalPrize === undefined ? null : <p className="df-summary-crops">{summary.festivalPrize}</p>}
            {summary.festival === undefined ? null : (
              <p className="df-summary-crops">
                Today is <strong>{summary.festival}</strong>. Look for it on the calendar in your journal.
              </p>
            )}
            <p className="df-summary-crops">{cropsLine(summary.grown, summary.ripe, summary.withered)}</p>
            {summary.built.length > 0 ? <p className="df-summary-crops">The carpenter finished overnight: <strong>{summary.built.join(', ')}</strong>.</p> : null}
            {summary.eggs > 0 ? <p className="df-summary-crops">{summary.eggs === 1 ? 'There is an egg in the coop.' : `There are ${summary.eggs} eggs in the coop.`}</p> : null}
            {summary.readyQuests.length > 0 ? (
              <p className="df-summary-crops">
                Ready to report: 
                <strong>{summary.readyQuests.join(', ')}</strong>
              </p>
            ) : null}
            <button className="df-button df-button-wide" type="button" onClick={dismissSummary} autoFocus>
              Start the day ({key})
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function cropsLine(grown: number, ripe: number, withered: number): string {
  const parts: string[] = [];
  if (grown > 0) parts.push(grown === 1 ? 'One crop grew.' : `${grown} crops grew.`);
  if (ripe > 0) parts.push(ripe === 1 ? 'One is ready to pick.' : `${ripe} are ready to pick.`);
  if (withered > 0) parts.push(withered === 1 ? 'One withered with the change of season.' : `${withered} withered with the change of season.`);
  return parts.length > 0 ? parts.join(' ') : 'Nothing is growing yet.';
}
