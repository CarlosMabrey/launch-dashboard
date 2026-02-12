# Calendar App - Project Structure

## 📅 Chronos Glyph Calendar

A magical, fully-featured calendar application with:
- Monthly/Weekly/Daily views
- Event creation & editing
- Drag & drop rescheduling
- Beautiful holographic UI
- Full local persistence
- Integration-ready API

---

## File Structure
```
calendar-app/
├── index.html          # Main entry point with Tailwind + styles
├── app.js             # Core application logic
├── styles.css         # Custom animations & effects
├── README.md          # This file
└── assets/            # Icons and images (optional)
```

---

## Tech Stack
- **Frontend**: Vanilla JavaScript (no framework needed for this scope)
- **Styling**: Tailwind CSS (CDN) + Custom CSS for magical effects
- **Icons**: Lucide Icons (CDN)
- **Storage**: LocalStorage with JSON serialization
- **Build**: None - pure static files

---

## Features

### 1. View Modes
- **Month Grid**: Classic calendar grid with event indicators
- **Week View**: 7-day column layout with time slots
- **Day View**: Detailed timeline for a single day

### 2. Event Management
- Create events with title, date, time, description, color
- Edit existing events via modal
- Delete events with confirmation
- Drag to reschedule (month view)
- Resize to change duration (week/day views)

### 3. UI/UX
- Holographic glass-morphism design
- Smooth transitions between views
- Color-coded event categories
- Current day highlighting
- Responsive layout

### 4. Data
- All data stored locally
- Export/Import JSON backup
- No server required

---

## API Endpoints (for Dashboard Integration)

The calendar can be mounted as a standalone app or embedded via iframe.

Standalone mode: Open `index.html` directly.

Embed mode: Use `?embed=true` query param to hide standalone chrome.

---

## Development Plan

1. ✓ Basic HTML structure with Tailwind
2. ✓ Calendar grid generation (month view)
3. ✓ Navigation (prev/next/today)
4. ✓ Event data model & storage
5. ✓ Event creation modal
6. ✓ Event editing & deletion
7. ✓ Week view
8. ✓ Day view
9. ✓ Drag & drop rescheduling
10. ✓ Animations & polish
11. ✓ Export/Import functionality
12. ✓ Integration with Pi's calendar API (optional)

---

## Color Palette (Holographic)
- Background: Deep space (#050510) with animated gradient
- Glass: rgba(255,255,255,0.05) backdrop blur
- Accent: Cyan (#00d4ff) - primary
- Accent: Purple (#9b59b6) - secondary
- Text: White/light gray for readability

---

## Integration Points

### Pi Backend Integration
If you want to sync with Pi's calendar API (`/api/pi/calendar`):

- Replace localStorage calls with `fetch()` to Pi endpoints
- Use Pi's OAuth/service account for auth
- Bi-directional sync: local changes push to server, remote changes pull

### Dashboard Embed
```html
<iframe src="/calendar-app/index.html?embed=true" class="w-full h-full border-0"></iframe>
```

---

## Notes

This is a standalone SPA designed to match the "Crystal Palace" aesthetic of your Dashboard. It can run independently or be embedded as an App Grimoire artifact.
