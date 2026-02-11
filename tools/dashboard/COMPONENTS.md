# Dashboard Components Map

## Location
All UI components: `src/components/` (or root `components/`)

## By Feature

- **Chat**: `PiWhispererCell.tsx` — main Pi chat interface (currently not used in main view but available)
- **Calendar**: `TemporalFluxCell.tsx` — full-featured Google Calendar integration with month/week/day views
- **Tasks**: `TodoBoardCell.tsx` — global todo board with agent spawning and filtering
- **Agents**: `AgentRosterCell.tsx` — multi-agent chat & documentation
- **Apps**: `AppGrimoireCell.tsx` — launchable artifacts grid with context menu
- **Voice**: `VoiceAssistantCell.tsx` — QWEN 3 TTS/STT interface with waveform
- **Settings**: `AuraSettings.tsx` — background mode toggle and color scheme
- **Background**: `BackgroundMode.tsx` — switches between CSS aura and Liquid Three.js background
- **Utilities**: `CommandPalette.tsx`, `ContextMenu.tsx`, `TitleBar.tsx` (Electron window controls)

## Props Contract

Each cell receives minimal props based on its needs. Examples:

### PiWhispererCell
```tsx
interface PiWhispererProps {
  chatHistory: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  isLoading: boolean;
}
```

### TemporalFluxCell
```tsx
interface TemporalFluxProps {
  events: CalendarEvent[];
  onRefresh: () => Promise<void>;
}
```

### SentimentScryerCell
```tsx
interface SentimentScryerProps {
  weather: MarketWeather;
}
```

### VanFundCell
```tsx
interface VanFundProps {
  data: VanFundData;
}
```

### ActivePulseCell
```tsx
interface ActivePulseProps {
  activity: GithubActivity;
}
```

## Design Tokens

Shared constants used across components (also defined in App.tsx):
- `GLASS = 'bg-white/5 backdrop-blur-xl border border-white/10'`
- `GLASS_HOVER = 'hover:bg-white/10 hover:border-white/20'`
- `ACCENT` color gradients (emerald, blue, red, purple, amber)

## To Modify a Cell

1. Open its dedicated `.tsx` file in `components/`
2. Changes are isolated — won't affect other cells
3. Restart Vite if needed (most changes hot-reload)

## Hooks

Custom hooks are available from `./hooks/useLocalStorage`:
- `useInterval(callback, delay)`
- `useLocalStorage<T>(key, initial)`
