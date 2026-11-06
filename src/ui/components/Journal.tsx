import { useState } from 'react';
import { frameStyle } from '../atlasImage';
import { useUi, useUiActions, type BestiaryView, type CalendarView, type CollectionEntry, type CollectionView, type QuestView } from '../store';

/** The journal (J): quests being worked on, waiting for a report, and finished. It pauses the game. */
export function Journal() {
  const open = useUi((s) => s.journalOpen);
  const quests = useUi((s) => s.quests);
  const collection = useUi((s) => s.collection);
  const calendar = useUi((s) => s.calendar);
  const bestiary = useUi((s) => s.bestiary);
  const key = useUi((s) => s.keys['journal']);
  const { closeJournal } = useUiActions();
  const [tab, setTab] = useState<'quests' | 'collection' | 'calendar' | 'creatures'>('quests');
  if (!open) return null;

  const current = quests.filter((q) => q.status !== 'done');
  const finished = quests.filter((q) => q.status === 'done');
  return (
    <div className="df-menu-backdrop" onClick={closeJournal}>
      <div className="df-journal df-panel-parchment" role="dialog" aria-label="Journal" onClick={(event) => event.stopPropagation()}>
        <div className="df-journal-head">
          <h1 className="df-journal-title">Journal</h1>
          <div className="df-tabs" role="tablist" aria-label="Journal pages">
            <button type="button" role="tab" aria-selected={tab === 'quests'} className={tab === 'quests' ? 'df-tab df-tab-on' : 'df-tab'} onClick={() => setTab('quests')}>
              Quests
            </button>
            <button type="button" role="tab" aria-selected={tab === 'collection'} className={tab === 'collection' ? 'df-tab df-tab-on' : 'df-tab'} onClick={() => setTab('collection')}>
              Collection
            </button>
            <button type="button" role="tab" aria-selected={tab === 'calendar'} className={tab === 'calendar' ? 'df-tab df-tab-on' : 'df-tab'} onClick={() => setTab('calendar')}>
              Calendar
            </button>
            {bestiary === undefined ? null : (
              <button type="button" role="tab" aria-selected={tab === 'creatures'} className={tab === 'creatures' ? 'df-tab df-tab-on' : 'df-tab'} onClick={() => setTab('creatures')}>
                Creatures
              </button>
            )}
          </div>
          <button className="df-hints-close" type="button" onClick={closeJournal} aria-label="Close the journal" title={`Close (${key})`} autoFocus>
            ×
          </button>
        </div>

        <div className="df-journal-scroll">
          {tab === 'collection' ? (
            <CollectionPage collection={collection} />
          ) : tab === 'calendar' ? (
            <CalendarPage calendar={calendar} />
          ) : tab === 'creatures' ? (
            <BestiaryPage bestiary={bestiary} />
          ) : (
            <>
              {quests.length === 0 ? <p className="df-journal-empty">Nothing in the journal yet. Villagers may have a favour to ask: say hello and see.</p> : null}
              {current.length > 0 ? <h2 className="df-journal-section">Now</h2> : null}
              {current.map((quest) => (
                <QuestEntry key={quest.id} quest={quest} />
              ))}
              {finished.length > 0 ? <h2 className="df-journal-section">Done</h2> : null}
              {finished.map((quest) => (
                <QuestEntry key={quest.id} quest={quest} />
              ))}
            </>
          )}
        </div>
        <p className="df-menu-foot">{key} or Esc to close.</p>
      </div>
    </div>
  );
}

/** The rare creatures of the valley: a question mark until one has been seen, then what it is, where and when it is about, and what it likes. */
function BestiaryPage({ bestiary }: { readonly bestiary: BestiaryView | undefined }) {
  if (bestiary === undefined) return null;
  return (
    <>
      <h2 className="df-journal-section">
        Rare creatures ({bestiary.seen} of {bestiary.entries.length} seen, {bestiary.friends} {bestiary.friends === 1 ? 'friend' : 'friends'})
      </h2>
      <p className="df-journal-empty">Walk up to one quietly, without running, to see it. Give a seen creature something it likes to befriend it.</p>
      <ul className="df-bestiary">
        {bestiary.entries.map((entry) => (
          <li key={entry.id} className={entry.seen ? 'df-creature' : 'df-creature df-creature-unknown'}>
            <span className="df-creature-picture" style={entry.seen ? frameStyle(entry.frame, '3') : undefined} aria-hidden="true">
              {entry.seen ? null : '?'}
            </span>
            <span className="df-creature-text">
              <strong>{entry.seen ? entry.name : 'Not seen yet'}</strong>
              {entry.friend ? <span className="df-creature-friend"> ♥ a friend</span> : null}
              {entry.seen ? (
                <>
                  <span className="df-creature-line">{entry.description}</span>
                  <span className="df-creature-line df-creature-where">{entry.habitat}</span>
                  <span className="df-creature-line">Likes: {entry.likes.join(', ')}.{entry.friend ? ` It left ${entry.keepsake}.` : ''}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This season in four weeks: today ringed, festivals and birthdays marked, the market day shaded, and what comes next. */
function CalendarPage({ calendar }: { readonly calendar: CalendarView | undefined }) {
  if (calendar === undefined) return null;
  const marked = calendar.days.filter((d) => d.marks.length > 0);
  return (
    <>
      <h2 className="df-journal-section">{calendar.season.charAt(0).toUpperCase() + calendar.season.slice(1)}, year {calendar.year}</h2>
      <div className="df-calendar" role="grid" aria-label={`${calendar.season} calendar`}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={`h${i}`} className="df-cal-head" role="columnheader">
            {letter}
          </div>
        ))}
        {calendar.days.map((day) => {
          const classes = ['df-cal-day'];
          if (day.day === calendar.today) classes.push('df-cal-today');
          if (day.market) classes.push('df-cal-market');
          const festival = day.marks.some((m) => m.kind === 'festival');
          const birthday = day.marks.some((m) => m.kind === 'birthday');
          if (festival) classes.push('df-cal-festival');
          return (
            <div key={day.day} className={classes.join(' ')} role="gridcell" aria-current={day.day === calendar.today ? 'date' : undefined} title={[...day.marks.map((m) => m.label), day.market ? 'Market day' : ''].filter(Boolean).join(' · ') || undefined}>
              <span className="df-cal-num">{day.day}</span>
              <span className="df-cal-marks" aria-hidden="true">
                {festival ? '✿' : ''}
                {birthday ? '♥' : ''}
              </span>
            </div>
          );
        })}
      </div>
      <p className="df-journal-empty">✿ a festival · ♥ a birthday · a shaded day is market day, when the merchant is on the green.</p>
      {marked.length > 0 ? (
        <ul className="df-agenda">
          {marked.flatMap((d) => d.marks.map((m) => (
            <li key={`${d.day}:${m.label}`}>
              <strong>{d.day}</strong> {m.kind === 'festival' ? '✿' : '♥'} {m.label}
            </li>
          )))}
        </ul>
      ) : null}
      <h2 className="df-journal-section">Coming up</h2>
      <ul className="df-agenda">
        {calendar.upcoming.map((u) => (
          <li key={`${u.when}:${u.label}`}>
            <strong>{u.when}</strong> {u.kind === 'festival' ? '✿' : '♥'} {u.label} <span className="df-agenda-in">{u.inDays === 1 ? 'tomorrow' : `in ${u.inDays} days`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Fish caught and minerals dug up: a picture and a count for each, a question mark for the ones not found yet. */
function CollectionPage({ collection }: { readonly collection: CollectionView | undefined }) {
  if (collection === undefined) return null;
  const found = (list: readonly CollectionEntry[]): number => list.filter((e) => e.count > 0).length;
  return (
    <>
      <h2 className="df-journal-section">
        Fish ({found(collection.fish)} of {collection.fish.length})
      </h2>
      <CollectionGrid entries={collection.fish} />
      <h2 className="df-journal-section">
        Minerals ({found(collection.minerals)} of {collection.minerals.length})
      </h2>
      <CollectionGrid entries={collection.minerals} />
      {collection.artifacts.length > 0 ? (
        <>
          <h2 className="df-journal-section">
            Artifacts ({found(collection.artifacts)} of {collection.artifacts.length})
          </h2>
          <CollectionGrid entries={collection.artifacts} />
        </>
      ) : null}
      {collection.museum === undefined ? null : (
        <>
          <h2 className="df-journal-section">The museum</h2>
          <p className="df-journal-empty">
            {collection.museum.have} of {collection.museum.total} things on display. A star marks what is already there.
          </p>
        </>
      )}
      <h2 className="df-journal-section">The old mine</h2>
      <p className="df-journal-empty">{collection.deepest === 0 ? 'You have not been down yet.' : `Deepest floor reached: ${collection.deepest} of ${collection.floors}.`}</p>
    </>
  );
}

function CollectionGrid({ entries }: { readonly entries: readonly CollectionEntry[] }) {
  return (
    <ul className="df-collection">
      {entries.map((entry) => (
        <li key={entry.id} className={entry.count > 0 ? 'df-collected' : 'df-collected df-collected-unknown'} title={entry.count > 0 ? entry.description : 'Not found yet'}>
          <span className="df-collected-icon" style={frameStyle(entry.icon, '2')} aria-hidden="true" />
          <span className="df-collected-name">{entry.count > 0 ? entry.name : '?'}</span>
          {entry.onDisplay ? <span className="df-collected-star" title="On display in the museum" aria-label="on display">★</span> : null}
          <span className="df-collected-count">{entry.count > 0 ? `×${entry.count}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function QuestEntry({ quest }: { readonly quest: QuestView }) {
  return (
    <article className={`df-quest df-quest-${quest.status}`}>
      <header className="df-quest-head">
        <h3 className="df-quest-title">{quest.title}</h3>
        <span className="df-quest-tag">
          {quest.status === 'ready' ? `Ready: tell ${quest.giver}` : quest.status === 'done' ? 'Done' : quest.giver}
        </span>
      </header>
      <p className="df-quest-summary">{quest.summary}</p>
      <ul className="df-quest-goals">
        {quest.objectives.map((goal, index) => (
          <li key={index} className={goal.done ? 'df-quest-goal df-quest-goal-done' : 'df-quest-goal'}>
            <span aria-hidden="true">{goal.done ? '✓' : '○'}</span> {goal.text}
          </li>
        ))}
      </ul>
      {quest.status === 'done' ? null : <p className="df-quest-reward">Reward: {quest.reward}</p>}
    </article>
  );
}

/** A little note under the clock: how many quests are open, and whether one is ready to report. */
export function QuestTracker() {
  const quests = useUi((s) => s.quests);
  const key = useUi((s) => s.keys['journal']);
  const hidden = useUi((s) => s.dialog !== undefined || s.menuOpen || s.journalOpen || s.focusLost);
  const open = quests.filter((q) => q.status !== 'done');
  if (open.length === 0 || hidden) return null;
  const ready = open.filter((q) => q.status === 'ready');
  return (
    <div className={ready.length > 0 ? 'df-tracker df-panel-parchment df-tracker-ready' : 'df-tracker df-panel-parchment'} role="status">
      <kbd className="df-key">{key}</kbd>
      <span>{ready.length > 0 ? `${ready.length} ready to report` : `${open.length} ${open.length === 1 ? 'quest' : 'quests'}`}</span>
    </div>
  );
}
