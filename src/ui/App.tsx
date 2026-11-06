import { DebugOverlay, DialogBox, FestivalRibbon, FocusOverlay, Frame, HintsPanel, InteractionPrompt, LocationBanner, Notice, SaveToast, StatusScreen } from './components/Hud';
import { FloatingHint, Hotbar, StatusPanel, SummaryScreen } from './components/Farm';
import { Journal, QuestTracker } from './components/Journal';
import { PauseMenu } from './components/PauseMenu';
import { UiContext, useUi, type UiContextValue } from './store';

/**
 * The interface laid over the game. The game itself is drawn on the canvas underneath;
 * everything here is optional and can be hidden to enjoy the world without it.
 */
export function App({ value }: { readonly value: UiContextValue }) {
  return (
    <UiContext.Provider value={value}>
      <Layers />
    </UiContext.Provider>
  );
}

function Layers() {
  const hudVisible = useUi((s) => s.hudVisible);
  return (
    <>
      <div className={hudVisible ? 'df-hud' : 'df-hud df-hud-hidden'}>
        <Frame />
        <LocationBanner />
        <HintsPanel />
        <StatusPanel />
        <FestivalRibbon />
        <QuestTracker />
        <InteractionPrompt />
        <FloatingHint />
        <Hotbar />
        <SaveToast />
      </div>
      {/* These always show: they carry a message the player needs, or a menu they asked for. */}
      <DialogBox />
      <SummaryScreen />
      <Journal />
      <Notice />
      <DebugOverlay />
      <PauseMenu />
      <FocusOverlay />
      <StatusScreen />
    </>
  );
}
