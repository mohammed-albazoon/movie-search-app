# Movie Search App

A feature-rich React application for discovering movies with weather-based suggestions, Netflix-style previews, and auto-playing trailers.

## Features

### Core Features
- **Movie Search** — Search movies using the OMDB API with pagination (up to 100 results)
- **Genre Filter** — Filter movies by genre (Adventure, Mystery, Romance, Fantasy, Action, Family, Drama)
- **Weather-Based Suggestions** — Get personalized movie recommendations based on your local weather
- **Netflix-Style Previews** — Hover over any movie card to see an expanded preview with trailer
- **Modern Dark Theme** — Sleek dark UI with ambient gradient backgrounds

### Preview System
- **Two Preview Modes:**
  - **Expand Mode** — Preview appears near the hovered card
  - **Modal Mode** — Preview appears centered on screen
- **Auto-Playing Trailers** — Trailers play automatically via TMDB API integration
- **Smart Positioning** — Previews stay within viewport bounds
- **Keyboard Support** — Press `Escape` to close previews

### Weather-to-Genre Mapping
| Weather Condition | Movie Genre |
|-------------------|-------------|
| Clear sky | Adventure |
| Fog | Mystery |
| Rain/Drizzle | Romance |
| Snow | Fantasy |
| Hot (≥30°C) | Action |
| Cold (≤5°C) | Family |
| Default | Drama |

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** — Build tool & dev server
- **Tailwind CSS 4** — Utility-first styling
- **Vitest** — Unit & integration testing
- **React Testing Library** — Component testing
- **OMDB API** — Movie search data
- **TMDB API** — Movie trailers & top-rated movies
- **Open-Meteo API** — Weather data

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/mohammed-albazoon/movie-search-app.git

# Navigate to the project
cd movie-search-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables (Optional)

For auto-playing trailers, add a TMDB API key:

```bash
# Create .env file
echo "VITE_TMDB_API_KEY=your_tmdb_api_key" > .env
```

Get a free API key at [themoviedb.org](https://www.themoviedb.org/settings/api)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run deploy` | Deploy to GitHub Pages |

## Testing

The app includes comprehensive test coverage:

```bash
# Run all tests
npm test
```

### Test Coverage

- **App Component** — Rendering, search functionality
- **Edge Cases** — Empty search, API errors, missing posters
- **Accessibility** — Keyboard navigation, escape key handling
- **Preview Interactions** — Hover, backdrop click, modal behavior
- **Weather Mapping** — All weather-to-genre mappings

## Project Structure

```
src/
├── App.tsx          # Main application component
├── App.css          # Component styles
├── App.test.tsx     # Test suite
├── main.tsx         # React DOM entry point
├── index.css        # Global styles
└── test/
    └── setup.ts     # Test configuration
```

## How It Works

1. **On Load** — App requests your location, fetches weather data, and suggests movies matching the weather mood
2. **Genre Filter** — Select a genre from the dropdown to browse movies by category
3. **Search** — Type a movie name and press Enter or click Search
4. **Preview** — Hover over any card for 700ms to see the expanded preview with trailer
5. **Watch** — Click any card to open the IMDB page

## API Integration

- **OMDB API** — Movie search and metadata
- **TMDB API** — YouTube trailer keys & top-rated movies
- **Open-Meteo API** — Weather data by coordinates

## Live Demo

[https://mohammed-albazoon.github.io/movie-search-app](https://mohammed-albazoon.github.io/movie-search-app)

## Acknowledgements

- [OMDB API](https://www.omdbapi.com/) for movie data
- [TMDB](https://www.themoviedb.org/) for trailer integration
- [Open-Meteo](https://open-meteo.com/) for weather data
- [Vite](https://vitejs.dev/) for the blazing fast build tool
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
