import { useEffect, useState, useRef } from 'react';
import './App.css';

// Types
interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
}

// Preview mode type
type PreviewMode = 'expand' | 'modal';

// Trailer state for loading/caching
interface TrailerState {
  youtubeKey: string | null;
  loading: boolean;
  error: boolean;
}

// TMDB API key from environment variable
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

// Search history entry type
interface SearchHistoryEntry {
  query: string;
  movies: Movie[];
}

// Available genres for dropdown
const GENRES = ['adventure', 'mystery', 'romance', 'fantasy', 'action', 'family', 'drama'] as const;
type Genre = typeof GENRES[number];

function App() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState(''); // The query that was actually searched
  const [movies, setMovies] = useState<Movie[]>([]);
  const [suggested, setSuggested] = useState<Movie[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]); // History stack
  const [selectedGenre, setSelectedGenre] = useState<Genre | ''>(''); // Genre dropdown state
  const [weatherReason, setWeatherReason] = useState<string>(''); // Why movies are suggested
  const [hoveredMovie, setHoveredMovie] = useState<Movie | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [previewMode, setPreviewMode] = useState<PreviewMode>('expand');  // NEW: toggle mode
  const hoverTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Trailer state
  const [trailer, setTrailer] = useState<TrailerState>({ youtubeKey: null, loading: false, error: false });
  const trailerCache = useRef<Map<string, string | null>>(new Map()); // Cache trailer keys by imdbID

  // 🔥 Map weather → movie genre
  function getGenreForWeather(code: number, temp: number) {
    if (code >= 0 && code <= 3) return "adventure";
    if (code >= 45 && code <= 48) return "mystery";
    if (code >= 51 && code <= 67) return "romance";
    if (code >= 71 && code <= 77) return "fantasy";
    if (temp >= 30) return "action";
    if (temp <= 5) return "family";
    return "drama";
  }

  // Get human-readable weather description
  function getWeatherDescription(code: number, temp: number): string {
    if (code >= 71 && code <= 77) return "it's snowing ❄️";
    if (code >= 51 && code <= 67) return "it's raining 🌧️";
    if (code >= 45 && code <= 48) return "it's foggy 🌫️";
    if (code >= 0 && code <= 3) return "it's clear and sunny ☀️";
    if (temp >= 30) return "it's hot outside 🔥";
    if (temp <= 5) return "it's freezing cold 🥶";
    return "the weather is mild 🌤️";
  }

  // Fetch ALL movies (handles pagination)
  async function fetchAllMoviesByGenre(genre: string) {
    let allMovies: Movie[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=thewdb&s=${genre}&page=${page}`
      );
      const data = await res.json();

      if (!data.Search) break;

      allMovies = [...allMovies, ...data.Search];
      page++;

      if (page > 10) break;
    }

    return allMovies;
  }

  // Fetch top-rated movies from TMDB (used when location is denied)
  async function fetchTopRatedMovies(): Promise<Movie[]> {
    if (!TMDB_API_KEY) {
      // Fallback to OMDB search if no TMDB key
      return fetchAllMoviesByGenre("movie");
    }

    try {
      const movies: Movie[] = [];
      // Fetch 3 pages of top-rated movies
      for (let page = 1; page <= 3; page++) {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`
        );
        const data = await res.json();

        if (data.results) {
          // Convert TMDB format to our Movie format, then fetch OMDB data for IMDB IDs
          for (const tmdbMovie of data.results) {
            // Get IMDB ID from TMDB
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/movie/${tmdbMovie.id}/external_ids?api_key=${TMDB_API_KEY}`
            );
            const detailData = await detailRes.json();

            if (detailData.imdb_id) {
              movies.push({
                imdbID: detailData.imdb_id,
                Title: tmdbMovie.title,
                Year: tmdbMovie.release_date?.split('-')[0] || 'N/A',
                Poster: tmdbMovie.poster_path
                  ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
                  : 'N/A'
              });
            }
          }
        }
      }
      return movies;
    } catch (error) {
      console.error('Failed to fetch top-rated movies:', error);
      return fetchAllMoviesByGenre("movie");
    }
  }

  // Fetch trailer from TMDB (searches by title, then gets YouTube key)
  async function fetchTrailerFromTMDB(title: string, year: string): Promise<string | null> {
    if (!TMDB_API_KEY) {
      console.warn('TMDB API key not configured. Add VITE_TMDB_API_KEY to .env file.');
      return null;
    }

    try {
      // Step 1: Search for the movie on TMDB
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&year=${year}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.results || searchData.results.length === 0) {
        return null;
      }

      const tmdbId = searchData.results[0].id;

      // Step 2: Get videos for this movie
      const videosUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
      const videosRes = await fetch(videosUrl);
      const videosData = await videosRes.json();

      if (!videosData.results || videosData.results.length === 0) {
        return null;
      }

      // Step 3: Find a YouTube trailer (prefer "Trailer" type, then "Teaser")
      const trailer = videosData.results.find(
        (v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube'
      ) || videosData.results.find(
        (v: { type: string; site: string }) => v.type === 'Teaser' && v.site === 'YouTube'
      ) || videosData.results.find(
        (v: { site: string }) => v.site === 'YouTube'
      );

      return trailer?.key || null;
    } catch (error) {
      console.error('Error fetching trailer:', error);
      return null;
    }
  }

  //
  // Fetch weather & suggested movies on load
  //
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
          );
          const weatherData = await weatherRes.json();
          const weatherCode = weatherData.current_weather.weathercode;
          const temperature = weatherData.current_weather.temperature;
          const genre = getGenreForWeather(weatherCode, temperature);
          const weatherDesc = getWeatherDescription(weatherCode, temperature);
          setWeatherReason(weatherDesc);
          const allMovies = await fetchAllMoviesByGenre(genre);
          setSuggested(allMovies);
        } catch (error) {
          console.error('Failed to fetch weather/movies:', error);
          // Fallback to top-rated movies on error
          setWeatherReason("they're top rated ⭐");
          const topMovies = await fetchTopRatedMovies();
          setSuggested(topMovies);
        }
      },
      async () => {
        try {
          // Fallback if geolocation denied/fails - show top-rated movies
          setWeatherReason("they're top rated ⭐");
          const topMovies = await fetchTopRatedMovies();
          setSuggested(topMovies);
        } catch (error) {
          console.error('Failed to fetch fallback movies:', error);
        }
      }
    );
  }, []);

  // NEW: Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hoveredMovie) {
        handleInstantClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredMovie]);

  // Fetch trailer when hoveredMovie changes
  useEffect(() => {
    if (!hoveredMovie) {
      setTrailer({ youtubeKey: null, loading: false, error: false });
      return;
    }

    // Check cache first
    const cachedKey = trailerCache.current.get(hoveredMovie.imdbID);
    if (cachedKey !== undefined) {
      setTrailer({ youtubeKey: cachedKey, loading: false, error: cachedKey === null });
      return;
    }

    // Fetch from TMDB
    setTrailer({ youtubeKey: null, loading: true, error: false });

    fetchTrailerFromTMDB(hoveredMovie.Title, hoveredMovie.Year).then((key) => {
      trailerCache.current.set(hoveredMovie.imdbID, key);
      setTrailer({ youtubeKey: key, loading: false, error: key === null });
    });
  }, [hoveredMovie]);

  // SEARCH FUNCTION
  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Save current state to history before new search
    if (hasSearched && searchedQuery) {
      setSearchHistory(prev => [...prev, { query: searchedQuery, movies }]);
    }

    setMovies([]); // Clear previous results before new search
    setSearchedQuery(trimmedQuery); // Store the query being searched
    setHasSearched(true);
    setIsSearching(true);
    setSelectedGenre(''); // Reset genre dropdown when searching
    let allMovies: Movie[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=thewdb&s=${trimmedQuery}&page=${page}`
      );
      const data = await response.json();

      if (!data.Search) break;

      allMovies = [...allMovies, ...data.Search];
      page++;

      if (page > 10) break;
    }

    setMovies(allMovies);
    setIsSearching(false);
  };

  // Handle genre selection from dropdown
  const handleGenreSelect = async (genre: Genre | '') => {
    setSelectedGenre(genre);

    // If "All Genres" selected, reset to suggestions view
    if (!genre) {
      setMovies([]);
      setHasSearched(false);
      setQuery('');
      setSearchedQuery('');
      return;
    }

    // Fetch movies for the selected genre
    setIsSearching(true);
    setHasSearched(true);
    setSearchedQuery(genre);
    setMovies([]);

    const genreMovies = await fetchAllMoviesByGenre(genre);
    setMovies(genreMovies);
    setIsSearching(false);
  };

  // Go back to previous search or suggestions
  const handleBack = () => {
    if (searchHistory.length > 0) {
      // Pop the last entry from history
      const previousSearch = searchHistory[searchHistory.length - 1];
      setSearchHistory(prev => prev.slice(0, -1));
      setMovies(previousSearch.movies);
      setSearchedQuery(previousSearch.query);
      setQuery(previousSearch.query);
    } else {
      // No history - go back to suggestions
      setMovies([]);
      setQuery('');
      setSearchedQuery('');
      setHasSearched(false);
      setSelectedGenre(''); // Reset genre dropdown
    }
  };

  // Open IMDb trailer/video page
  const openIMDbTrailer = (imdbID: string) => {
    window.open(`https://www.imdb.com/title/${imdbID}`, "_blank");
  };

  // Handle mouse enter with delay
  const handleMouseEnter = (movie: Movie, cardElement: HTMLDivElement | null) => {
    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);  // Cancel any pending close
      closeTimeoutRef.current = null;
    }

    // Set timeout for 700ms delay (Netflix-style)
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
        
        // Calculate position for expanded preview
        let left = rect.left + scrollLeft + (rect.width / 2) - 175; // Center the 350px preview
        const top = rect.top + scrollTop - 20;
        
        // Keep within viewport bounds
        if (left < 10) left = 10;
        if (left + 350 > window.innerWidth - 10) left = window.innerWidth - 360;
        
        setPreviewPosition({ top, left });
      }
      setHoveredMovie(movie);
    }, 700);
  };

  // Handle mouse leave - with delay to allow moving to preview
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // In modal mode, don't auto-close on mouse leave
    // Modal is centered, so user can't "move to it" - they must explicitly close it
    if (previewMode === 'modal' && hoveredMovie) {
      return;
    }

    // Add 300ms delay before closing - gives time to move to preview (expand mode only)
    closeTimeoutRef.current = window.setTimeout(() => {
      setHoveredMovie(null);
    }, 300);
  };

  // Cancel close when entering the preview
  const handlePreviewEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Instant close (for backdrop click)
  const handleInstantClose = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setHoveredMovie(null);
  };

  // Click handler - still opens IMDB
  const handleCardClick = (imdbID: string) => {
    window.open(`https://www.imdb.com/title/${imdbID}/videogallery/`, '_blank');
  };

  // Render movie card with staggered animation
  const renderCard = (movie: Movie, index: number) => (
    <div
      key={movie.imdbID}
      className={`movie-card ${hoveredMovie?.imdbID === movie.imdbID ? 'is-previewing' : ''}`}
      style={{ '--card-index': Math.min(index, 20) } as React.CSSProperties}
      ref={(el) => {
        if (el) cardRefs.current.set(movie.imdbID, el);
      }}
      onMouseEnter={(e) => handleMouseEnter(movie, e.currentTarget)}
      onMouseLeave={handleMouseLeave}
      onClick={() => handleCardClick(movie.imdbID)}
    >
      <div className="movie-card-inner">
        {movie.Poster !== "N/A" ? (
          <img src={movie.Poster} alt={movie.Title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">
            <span>No Image</span>
          </div>
        )}

        <div className="movie-info">
          <h3>{movie.Title}</h3>
          <p>{movie.Year}</p>
        </div>
      </div>
    </div>
  );

  // Render expanded preview (Netflix-style)
  const renderExpandedPreview = () => {
    if (!hoveredMovie) return null;

    // Shared content for both modes
    const previewContent = (
      <>
        {/* Trailer video or poster fallback */}
        <div className="trailer-container">
          {/* Loading state */}
          {trailer.loading && (
            <div className="trailer-loading">
              <div className="loading-spinner"></div>
              <span>Loading trailer...</span>
            </div>
          )}

          {/* YouTube embed when trailer is available */}
          {!trailer.loading && trailer.youtubeKey && (
            <iframe
              src={`https://www.youtube.com/embed/${trailer.youtubeKey}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0`}
              title={`${hoveredMovie.Title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="trailer-iframe"
            />
          )}

          {/* Fallback: Poster when no trailer or API key not configured */}
          {!trailer.loading && !trailer.youtubeKey && (
            <>
              {hoveredMovie.Poster !== "N/A" ? (
                <img
                  src={hoveredMovie.Poster}
                  alt={hoveredMovie.Title}
                  className="preview-poster"
                />
              ) : (
                <div className="preview-poster-placeholder">
                  <span>No Image</span>
                </div>
              )}

              {/* Play button overlay - opens YouTube search */}
              <div
                className="trailer-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.youtube.com/results?search_query=${encodeURIComponent(hoveredMovie.Title + ' official trailer')}`,
                    '_blank'
                  );
                }}
              >
                <div className="play-button">▶</div>
                <span>{TMDB_API_KEY ? 'No trailer found - Search YouTube' : 'Search Trailer on YouTube'}</span>
              </div>
            </>
          )}
        </div>

        {/* Movie info */}
        <div className="preview-info">
          <h3>{hoveredMovie.Title}</h3>
          <p className="preview-year">{hoveredMovie.Year}</p>
          
          <div className="preview-actions">
            <button 
              className="action-btn primary"
              onClick={(e) => {
                e.stopPropagation();
                openIMDbTrailer(hoveredMovie.imdbID);
              }}
            >
              ▶ Trailer
            </button>
            <button 
              className="action-btn secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick(hoveredMovie.imdbID);
              }}
            >
              ℹ️ IMDB
            </button>
          </div>
        </div>
      </>
    );

    // MODAL MODE: Centered overlay
    if (previewMode === 'modal') {
      return (
        <>
          <div 
            className="preview-backdrop modal-backdrop" 
            onClick={handleInstantClose}
          />
          
          <div
            className="modal-preview"
            onMouseEnter={handlePreviewEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Close button */}
            <button 
              className="modal-close-btn"
              onClick={handleInstantClose}
            >
              ✕
            </button>
            
            {previewContent}
          </div>
        </>
      );
    }

    // EXPAND MODE: Position near card (default)
    return (
      <>
        <div 
          className="preview-backdrop" 
          onClick={handleInstantClose}
        />
        
        <div
          className="expanded-preview"
          style={{
            top: previewPosition.top,
            left: previewPosition.left,
          }}
          onMouseEnter={handlePreviewEnter}
          onMouseLeave={handleMouseLeave}
        >
          {previewContent}
        </div>
      </>
    );
  };

  return (
    <div className="app-container">
      {/* Ambient background with animated gradient blobs */}
      <div className="ambient-background">
        <div className="ambient-blob ambient-blob--primary" />
        <div className="ambient-blob ambient-blob--secondary" />
        <div className="ambient-blob ambient-blob--tertiary" />
        <div className="ambient-blob ambient-blob--bottom" />
      </div>

      {/* Main content */}
      <div className="app-content">
        <h1 className="app-title text-gradient">Movie Search App</h1>

        <div className="search-bar">
          {/* Back button - shows when user has searched */}
          {hasSearched && (
            <button className="back-btn" onClick={handleBack} title="Go back">
              ←
            </button>
          )}

          {/* Genre dropdown */}
          <select
            className="genre-select"
            value={selectedGenre}
            onChange={(e) => handleGenreSelect(e.target.value as Genre | '')}
          >
            <option value="">All Genres</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre.charAt(0).toUpperCase() + genre.slice(1)}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="search-input"
            placeholder="Search for a movie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>Search</button>

          {/* Preview mode toggle */}
          <div className="preview-mode-toggle">
            <button
              className={`toggle-btn ${previewMode === 'expand' ? 'active' : ''}`}
              onClick={() => setPreviewMode('expand')}
              title="Expand in place"
            >
              ⬚
            </button>
            <button
              className={`toggle-btn ${previewMode === 'modal' ? 'active' : ''}`}
              onClick={() => setPreviewMode('modal')}
              title="Center modal"
            >
              ▣
            </button>
          </div>
        </div>

        {/* No results message - only show when search is complete and no results */}
        {hasSearched && !isSearching && movies.length === 0 && (
          <div className="no-results">
            <p>No movies found for "{searchedQuery}"</p>
            <p className="no-results-hint">Try a different search term</p>
          </div>
        )}

        {/* Suggested movies (only when no search performed) */}
        {!hasSearched && movies.length === 0 && suggested.length > 0 && (
          <>
            <h2 className="section-title">
              Suggested for you{weatherReason && <span className="weather-reason"> because {weatherReason}</span>}
            </h2>
            <div className="movies-grid">
              {suggested.map((movie, index) => renderCard(movie, index))}
            </div>
          </>
        )}

        {/* Search results */}
        {movies.length > 0 && (
          <div className="movies-grid">
            {movies.map((movie, index) => renderCard(movie, index))}
          </div>
        )}
      </div>

      {/* Expanded preview portal */}
      {renderExpandedPreview()}
    </div>
  );
}

export default App;