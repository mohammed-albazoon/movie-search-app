# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + TypeScript movie search application using the OMDB API. Features weather-driven movie suggestions, Netflix-style hover previews, and interactive movie cards.

## Development Commands

**Start dev server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```
Note: Build runs TypeScript compilation (`tsc -b`) followed by Vite build.

**Lint code:**
```bash
eslint .
```

**Preview production build:**
```bash
npm run preview
```

## Architecture & Key Patterns

### Single Component Application
The entire app is built as a single component in [src/App.tsx](src/App.tsx). There are no separate component files, hooks, or utilities. All functionality lives in `App.tsx`.

### API Integration
- **API:** OMDB API (https://www.omdbapi.com)
- **API Key:** Hardcoded as `thewdb` in fetch calls
- **Pagination:** Custom implementation fetches up to 10 pages (max ~100 movies) for comprehensive results
- **Search endpoint:** `?apikey=thewdb&s={query}&page={page}`

### State Management
Uses React `useState` for all state:
- `movies`: Search results
- `suggested`: Weather-based suggestions loaded on mount
- `hoveredMovie`: Currently previewed movie
- `previewMode`: Toggle between 'expand' (near-card) and 'modal' (centered) preview styles

Uses `useRef` for:
- Timeout management (hover delays, close delays)
- Card element references (for positioning previews)

### Preview System (Netflix-style)
**Two preview modes:**
1. **Expand mode** (default): Preview appears near the hovered card
2. **Modal mode**: Preview appears centered on screen

**Interaction flow:**
- 700ms hover delay before preview appears (prevents accidental triggers)
- 300ms close delay when mouse leaves (allows moving to preview)
- Escape key closes preview
- Backdrop click closes preview
- Preview includes: poster, title, year, "Trailer" button (opens IMDB), "IMDB" button (opens videogallery)

**Implementation details:**
- Positioning calculated from card `getBoundingClientRect()` in [src/App.tsx:124-138](src/App.tsx#L124-L138)
- Viewport bounds checking prevents preview from going off-screen
- `is-previewing` class added to hovered card for visual feedback
- Shared preview content rendered differently based on `previewMode`

### Weather-Based Suggestions
On mount, the app maps weather conditions to movie genres using a hardcoded function `getGenreForWeather()` at [src/App.tsx:27-35](src/App.tsx#L27-L35):
- Weather code 0-3 → "adventure"
- Code 45-48 → "mystery"
- Code 51-67 → "romance"
- Code 71-77 → "fantasy"
- Temp ≥30°C → "action"
- Temp ≤5°C → "family"
- Default → "drama"

Currently uses hardcoded values (code: 20, temp: 15) resulting in "drama" suggestions. This could be extended to use real weather API data.

### Movie Card Interactions
- **Hover:** Triggers preview after 700ms delay
- **Click:** Opens IMDB videogallery page in new tab
- Cards maintain reference in `cardRefs` Map for positioning calculations

## Code Style Notes

- TypeScript with explicit interfaces (`Movie`, `PreviewMode`)
- Inline event handlers and arrow functions throughout
- CSS classes follow BEM-like naming (e.g., `movie-card`, `preview-backdrop`, `modal-preview`)
- No PropTypes or strict type checking beyond TypeScript inference
- Uses modern React patterns (hooks, functional components, StrictMode)

## File Structure

```
src/
  App.tsx       - Main application component (all logic)
  App.css       - Component styles
  main.tsx      - React DOM mounting point
  index.css     - Global styles
  vite-env.d.ts - Vite type definitions
```

## Tech Stack

- **React 19.1.0** with TypeScript
- **Vite 7.0.4** (build tool & dev server)
- **ESLint 9.30.1** with React plugins
- No state management libraries (Context, Redux, etc.)
- No routing library (single page)
- No UI component library

## Notes

- English is not my first langausge, if I word anything ambiguously please ask me for input and clarification
