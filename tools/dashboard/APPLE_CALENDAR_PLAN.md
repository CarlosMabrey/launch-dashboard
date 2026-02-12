# Apple Calendar Implementation Plan

## Design Goals
- Warm, translucent aesthetic (Apple's "frosted glass")
- Smooth transitions between month/week/day views
- Clean typography: San Francisco-style (system fonts)
- Subtle shadows and rounded corners (12-16px radius)
- Color palette: warm grays, soft orange/amber accents, gentle blues

## Features to Add
1. **View Toggle**: Segmented control (Month | Week | Day)
2. **Week View**: Horizontal scrollable days with time slots (8am-8pm)
3. **Day View**: Vertical timeline with hourly slots
4. **Month View**: Keep existing but style more like Apple
5. **Event Cards**: Rounded rectangles with color coding
6. **Current Time Indicator**: Red line for current time (week/day)
7. **Today Highlight**: Soft blue background circle
8. **Smooth Animations**: CSS transitions, spring physics

## Component Structure
- State: `view` ('month' | 'week' | 'day')
- Header: Month/Week navigation + View toggle + Today button
- Content area switches based on view

## Apple-Inspired CSS Classes
- Warm backgrounds: `bg-gray-50`, `bg-gray-100`
- Card shadows: `shadow-sm`, `shadow-md`, `shadow-lg`
- Roundness: `rounded-xl`, `rounded-2xl`
- Glass effect: `bg-white/80`, `backdrop-blur-md`, `border-white/20`
