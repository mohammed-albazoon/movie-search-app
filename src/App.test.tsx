import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

// Mock the geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: Create mock responses for fallback when geolocation is denied
// Note: Without TMDB API key in tests, the app falls back to OMDB search with "movie"
const createTMDBMock = (movies: Array<{ imdbID: string; Title: string; Year: string; Poster: string }>) => {
  return (url: string) => {
    // TMDB top_rated endpoint
    if (url.includes('api.themoviedb.org') && url.includes('top_rated')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          results: movies.map((m, i) => ({
            id: i + 1,
            title: m.Title,
            release_date: `${m.Year}-01-01`,
            // Only use poster_path format for relative paths, not full URLs
            poster_path: m.Poster !== 'N/A' && !m.Poster.startsWith('http') ? m.Poster : null,
          })),
        }),
      });
    }
    // TMDB external_ids endpoint (get IMDB ID)
    if (url.includes('api.themoviedb.org') && url.includes('external_ids')) {
      const idMatch = url.match(/\/movie\/(\d+)\/external_ids/);
      const movieIndex = idMatch ? parseInt(idMatch[1]) - 1 : 0;
      return Promise.resolve({
        json: () => Promise.resolve({
          imdb_id: movies[movieIndex]?.imdbID || 'tt0000000',
        }),
      });
    }
    // OMDB search endpoint - only return movies for page=1
    if (url.includes('omdbapi.com')) {
      const isPage1 = url.includes('page=1') || !url.includes('page=');
      if (isPage1) {
        return Promise.resolve({
          json: () => Promise.resolve({ Search: movies }),
        });
      }
      // Page 2+ returns null to stop pagination
      return Promise.resolve({
        json: () => Promise.resolve({ Search: null }),
      });
    }
    // Default empty response
    return Promise.resolve({ json: () => Promise.resolve({}) });
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  });
});

describe('App Component', () => {
  it('renders the app title', async () => {
    // Arrange: Set up geolocation to fail (triggers fallback)
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    // Mock fetch to return empty results
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ Search: null }),
    });

    // Act: Render the component
    render(<App />);

    
    // Assert: Check that title is displayed
    expect(screen.getByText(/Movie Search App/i)).toBeInTheDocument();

    // Wait for async operations to complete (removes act() warning)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('renders search input and button', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ Search: null }),
    });

    render(<App />);

    expect(screen.getByPlaceholderText(/Search for a movie/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('searches for movies when user types and clicks search', async () => {
    // Setup userEvent instance
    const user = userEvent.setup();

    // Mock geolocation to fail (we're testing search, not suggestions)
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    // Mock fetch to handle both initial load and search
    const searchMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
      { imdbID: 'tt0068646', Title: 'The Godfather', Year: '1972', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation((url: string) => {
      // Search for "Shawshank" - return movies for page 1 only
      if (url.includes('s=Shawshank') && url.includes('page=1')) {
        return Promise.resolve({ json: () => Promise.resolve({ Search: searchMovies }) });
      }
      // All other calls return no results
      return Promise.resolve({ json: () => Promise.resolve({ Search: null }) });
    });

    // Render the app
    render(<App />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Find the search input and button
    const searchInput = screen.getByPlaceholderText(/Search for a movie/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // Type "Shawshank" into the search input
    await user.type(searchInput, 'Shawshank');

    // Click the search button
    await user.click(searchButton);

    // Verify fetch was called with correct URL
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=Shawshank')
      );
    });

    // Verify movie titles appear on screen
    await waitFor(() => {
      expect(screen.getByText('The Shawshank Redemption')).toBeInTheDocument();
      expect(screen.getByText('The Godfather')).toBeInTheDocument();
    });
  });

  it('searches when user presses Enter key', async () => {
    const user = userEvent.setup();

    // Setup mocks
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const searchMovies = [
      { imdbID: 'tt0468569', Title: 'The Dark Knight', Year: '2008', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation((url: string) => {
      // Search for "Batman" - return movies for page 1 only
      if (url.includes('s=Batman') && url.includes('page=1')) {
        return Promise.resolve({ json: () => Promise.resolve({ Search: searchMovies }) });
      }
      // All other calls return no results
      return Promise.resolve({ json: () => Promise.resolve({ Search: null }) });
    });

    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Find input and type search query
    const searchInput = screen.getByPlaceholderText(/Search for a movie/i);
    await user.type(searchInput, 'Batman');

    // Press Enter key instead of clicking button
    await user.keyboard('{Enter}');

    // Verify search was triggered
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=Batman')
      );
    });

    // Verify movie appears
    await waitFor(() => {
      expect(screen.getByText('The Dark Knight')).toBeInTheDocument();
    });
  });

  it('displays weather-based suggestions when geolocation succeeds', async () => {
    // Mock successful geolocation (user allows location)
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: { latitude: 40.7128, longitude: -74.006 }, // New York coordinates
      });
    });

    // Mock weather API response: Clear sky (code 0) = "adventure" genre
    const weatherResponse = {
      current_weather: {
        weathercode: 0,  // Clear sky → maps to "adventure"
        temperature: 25,
      },
    };

    // Mock movie suggestions
    const adventureMovies = {
      Search: [
        { imdbID: 'tt0107290', Title: 'Jurassic Park', Year: '1993', Poster: 'N/A' },
        { imdbID: 'tt0082971', Title: 'Indiana Jones', Year: '1981', Poster: 'N/A' },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(weatherResponse) })  // Weather API
      .mockResolvedValueOnce({ json: () => Promise.resolve(adventureMovies) })  // Movies page 1
      .mockResolvedValue({ json: () => Promise.resolve({ Search: null }) });    // Movies page 2+ (stops loop)

    render(<App />);

    // Verify "Suggested for you" heading appears
    await waitFor(() => {
      expect(screen.getByText(/Suggested for you/i)).toBeInTheDocument();
    });

    // Verify adventure movies are displayed
    await waitFor(() => {
      expect(screen.getByText('Jurassic Park')).toBeInTheDocument();
      expect(screen.getByText('Indiana Jones')).toBeInTheDocument();
    });

    // Verify weather API was called with correct coordinates
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('latitude=40.7128')
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('longitude=-74.006')
    );
  });

  it('toggles between expand and modal preview modes', async () => {
    const user = userEvent.setup();

    // Setup mocks
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ Search: null }),
    });

    render(<App />);

    // Find the toggle buttons by their title attributes
    const expandButton = screen.getByTitle('Expand in place');
    const modalButton = screen.getByTitle('Center modal');

    // Initially, expand mode should be active
    expect(expandButton).toHaveClass('active');
    expect(modalButton).not.toHaveClass('active');

    // Click modal button
    await user.click(modalButton);

    // Now modal should be active, expand should not
    expect(modalButton).toHaveClass('active');
    expect(expandButton).not.toHaveClass('active');

    // Click expand button again
    await user.click(expandButton);

    // Expand should be active again
    expect(expandButton).toHaveClass('active');
    expect(modalButton).not.toHaveClass('active');

    // Wait for any async operations
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

// ============================================
// Edge Cases & Error Handling Tests
// ============================================
describe('Edge Cases & Error Handling', () => {
  it('does not search when input is empty', async () => {
    const user = userEvent.setup();

    // Setup mocks
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ Search: null }),
    });

    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Record current fetch call count
    const initialCallCount = mockFetch.mock.calls.length;

    // Click search button WITHOUT typing anything
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Small delay to ensure any async operations would have fired
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify fetch was NOT called again (still same count)
    expect(mockFetch.mock.calls.length).toBe(initialCallCount);
  });

  it('handles API errors gracefully without crashing', async () => {
    // Spy on console.error to verify error is logged (optional)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup mocks - geolocation fails
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    // Mock fetch to REJECT (simulate network error)
    mockFetch.mockRejectedValue(new Error('Network error'));

    // This should NOT throw an error
    render(<App />);

    // Wait a bit for any async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // App should still render the title (didn't crash)
    expect(screen.getByText(/Movie Search App/i)).toBeInTheDocument();

    // App should still show the search input
    expect(screen.getByPlaceholderText(/Search for a movie/i)).toBeInTheDocument();

    // Cleanup spy
    consoleErrorSpy.mockRestore();
  });

  it('displays "No Image" placeholder when poster is N/A', async () => {
    // Use successful geolocation + weather to trigger OMDB search (not TMDB top-rated)
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({ coords: { latitude: 40.7128, longitude: -74.006 } });
    });

    // Mock movie WITH N/A poster and one WITH a valid poster
    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'Movie Without Poster', Year: '1994', Poster: 'N/A' },
      { imdbID: 'tt0068646', Title: 'Movie With Poster', Year: '1972', Poster: 'https://example.com/poster.jpg' },
    ];

    mockFetch.mockImplementation((url: string) => {
      // Weather API
      if (url.includes('open-meteo.com')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            current_weather: { weathercode: 0, temperature: 20 },
          }),
        });
      }
      // OMDB - return movies for page 1
      if (url.includes('omdbapi.com') && url.includes('page=1')) {
        return Promise.resolve({ json: () => Promise.resolve({ Search: mockMovies }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ Search: null }) });
    });

    render(<App />);

    // Wait for movies to appear (use getAllByText due to React StrictMode)
    await waitFor(() => {
      expect(screen.getAllByText('Movie Without Poster').length).toBeGreaterThan(0);
    });

    // 1. Find the movie card for "Movie Without Poster"
    const cardWithoutPoster = screen.getAllByText('Movie Without Poster')[0].closest('.movie-card');
    // 2. Check that it contains a placeholder div with "No Image" text
    const placeholder = cardWithoutPoster?.querySelector('.poster-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder?.textContent).toContain('No Image');

    // 3. Find the movie card for "Movie With Poster"
    const cardWithPoster = screen.getAllByText('Movie With Poster')[0].closest('.movie-card');
    // 4. Check that it contains an <img> element (not a placeholder)
    const posterImage = cardWithPoster?.querySelector('img');
    expect(posterImage).toBeInTheDocument();
    expect(posterImage).toHaveAttribute('src', 'https://example.com/poster.jpg');

  });

  it('displays "no results" message when search returns empty', async () => {
    const user = userEvent.setup();

    // Setup mocks
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    // Mock fetch: initial load returns nothing, search also returns nothing
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ Search: null }),
    });

    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Type a search term that will return no results
    const searchInput = screen.getByPlaceholderText(/Search for a movie/i);
    await user.type(searchInput, 'xyznonexistent123');

    // Click search button
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Verify "no results" message appears
    await waitFor(() => {
      expect(screen.getByText(/No movies found for/i)).toBeInTheDocument();
      expect(screen.getByText(/xyznonexistent123/i)).toBeInTheDocument();
    });

    // Verify the hint text is shown
    expect(screen.getByText(/Try a different search term/i)).toBeInTheDocument();

    // Verify suggestions are NOT shown
    expect(screen.queryByText(/Suggested for you/i)).not.toBeInTheDocument();
  });

  it('clears previous search results when performing a new search', async () => {
    const user = userEvent.setup();

    // Setup mocks
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    // Mock data for two different searches
    const batmanMovies = [
      { imdbID: 'tt0372784', Title: 'Batman Begins', Year: '2005', Poster: 'N/A' },
      { imdbID: 'tt0468569', Title: 'The Dark Knight', Year: '2008', Poster: 'N/A' },
    ];

    const spiderMovies = [
      { imdbID: 'tt0145487', Title: 'Spider-Man', Year: '2002', Poster: 'N/A' },
      { imdbID: 'tt0316654', Title: 'Spider-Man 2', Year: '2004', Poster: 'N/A' },
    ];

    // Mock fetch based on search query
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('s=Batman') && url.includes('page=1')) {
        return Promise.resolve({ json: () => Promise.resolve({ Search: batmanMovies }) });
      }
      if (url.includes('s=Spider') && url.includes('page=1')) {
        return Promise.resolve({ json: () => Promise.resolve({ Search: spiderMovies }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ Search: null }) });
    });

    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText(/Search for a movie/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // --- First search: Batman ---
    await user.type(searchInput, 'Batman');
    await user.click(searchButton);

    // Verify Batman movies appear
    await waitFor(() => {
      expect(screen.getByText('Batman Begins')).toBeInTheDocument();
      expect(screen.getByText('The Dark Knight')).toBeInTheDocument();
    });

    // --- Second search: Spider ---
    await user.clear(searchInput);
    await user.type(searchInput, 'Spider');
    await user.click(searchButton);

    // Verify Spider movies appear
    await waitFor(() => {
      expect(screen.getByText('Spider-Man')).toBeInTheDocument();
      expect(screen.getByText('Spider-Man 2')).toBeInTheDocument();
    });

    // CRITICAL: Verify Batman movies are NO LONGER present
    expect(screen.queryByText('Batman Begins')).not.toBeInTheDocument();
    expect(screen.queryByText('The Dark Knight')).not.toBeInTheDocument();
  });
});

// ============================================
// Accessibility & Keyboard Navigation Tests
// ============================================
describe('Accessibility & Keyboard Navigation', () => {
  it('closes preview when Escape key is pressed', async () => {
    const user = userEvent.setup();

    // Setup mocks - geolocation denied triggers TMDB top-rated fetch
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation(createTMDBMock(mockMovies));

    render(<App />);

    // Wait for movie to appear (use findAllByText due to React StrictMode double-render)
    await waitFor(() => {
      expect(screen.getAllByText('The Shawshank Redemption').length).toBeGreaterThan(0);
    });
    const movieTitle = screen.getAllByText('The Shawshank Redemption')[0];
    const movieCard = movieTitle.closest('.movie-card');

    // Hover to trigger preview (need to wait 700ms)
    await user.hover(movieCard!);

    // Wait for preview to appear
    await waitFor(
      () => {
        expect(screen.getByText('▶ Trailer')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Press Escape key
    await user.keyboard('{Escape}');

    // Preview should be closed - trailer button should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText('▶ Trailer')).not.toBeInTheDocument();
    });
  });

  it('closes preview when backdrop is clicked', async () => {
    const user = userEvent.setup();

    // Setup mocks - geolocation denied triggers TMDB top-rated fetch
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation(createTMDBMock(mockMovies));

    render(<App />);

    // Wait for movie to appear (use findAllByText due to React StrictMode double-render)
    await waitFor(() => {
      expect(screen.getAllByText('The Shawshank Redemption').length).toBeGreaterThan(0);
    });
    const movieTitle = screen.getAllByText('The Shawshank Redemption')[0];
    const movieCard = movieTitle.closest('.movie-card');

    // Hover to trigger preview
    await user.hover(movieCard!);

    // Wait for preview to appear
    await waitFor(
      () => {
        expect(screen.getByText('▶ Trailer')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Find the backdrop element and click it to close the preview
    const backdrop = document.querySelector('.preview-backdrop');
    await user.click(backdrop!);

    // Preview should be closed
    await waitFor(() => {
      expect(screen.queryByText('▶ Trailer')).not.toBeInTheDocument();
    });
  });

  it('modal mode keeps preview open when mouse leaves card', async () => {
    const user = userEvent.setup();

    // Setup mocks - geolocation denied triggers TMDB top-rated fetch
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation(createTMDBMock(mockMovies));

    render(<App />);

    // Switch to modal mode BEFORE hovering
    const modalButton = screen.getByTitle('Center modal');
    await user.click(modalButton);

    // Wait for movie to appear (use findAllByText due to React StrictMode double-render)
    await waitFor(() => {
      expect(screen.getAllByText('The Shawshank Redemption').length).toBeGreaterThan(0);
    });
    const movieTitle = screen.getAllByText('The Shawshank Redemption')[0];
    const movieCard = movieTitle.closest('.movie-card');

    // Hover to trigger preview
    await user.hover(movieCard!);

    // Wait for preview to appear
    await waitFor(
      () => {
        expect(screen.getByText('▶ Trailer')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Move mouse away from the card
    await user.unhover(movieCard!);

    // Wait longer than the 300ms close timeout to prove modal mode prevents it
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Preview should STILL be visible (modal mode doesn't auto-close)
    expect(screen.getByText('▶ Trailer')).toBeInTheDocument();
  });
});

// ============================================
// Movie Card Interaction Tests
// ============================================
describe('Movie Card Interactions', () => {
  it('opens IMDB videogallery when card is clicked', async () => {
    const user = userEvent.setup();

    // Mock window.open
    const mockWindowOpen = vi.fn();
    vi.stubGlobal('open', mockWindowOpen);

    // Setup mocks - geolocation denied triggers TMDB top-rated fetch
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation(createTMDBMock(mockMovies));

    render(<App />);

    // Wait for movie to appear (use getAllByText due to React StrictMode double-render)
    await waitFor(() => {
      expect(screen.getAllByText('The Shawshank Redemption').length).toBeGreaterThan(0);
    });

    // Click on the movie card
    const movieCard = screen.getAllByText('The Shawshank Redemption')[0].closest('.movie-card');
    await user.click(movieCard!);

    // Verify window.open was called with correct IMDB URL
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.imdb.com/title/tt0111161/videogallery/',
      '_blank'
    );
  });

  it('shows preview after hovering on card for 700ms', async () => {
    const user = userEvent.setup();

    // Setup mocks - geolocation denied triggers TMDB top-rated fetch
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error(new Error('Geolocation denied'));
    });

    const mockMovies = [
      { imdbID: 'tt0111161', Title: 'The Shawshank Redemption', Year: '1994', Poster: 'N/A' },
    ];

    mockFetch.mockImplementation(createTMDBMock(mockMovies));

    render(<App />);

    // Wait for movie to appear (use getAllByText due to React StrictMode double-render)
    await waitFor(() => {
      expect(screen.getAllByText('The Shawshank Redemption').length).toBeGreaterThan(0);
    });
    const movieTitle = screen.getAllByText('The Shawshank Redemption')[0];
    const movieCard = movieTitle.closest('.movie-card');

    // Hover over the card
    await user.hover(movieCard!);

    // Preview should NOT appear immediately
    expect(screen.queryByText('▶ Trailer')).not.toBeInTheDocument();

    // Wait for the 700ms hover delay + a bit extra
    await waitFor(
      () => {
        expect(screen.getByText('▶ Trailer')).toBeInTheDocument();
      },
      { timeout: 1000 } // Wait up to 1 second for preview to appear
    );
  });
});

// ============================================
// Weather-to-Genre Mapping Tests
// ============================================
describe('Weather-to-Genre Mapping', () => {
  // Helper to set up geolocation + weather mocks
  const setupWeatherMock = (weatherCode: number, temperature: number) => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({ coords: { latitude: 40.7, longitude: -74.0 } });
    });

    const weatherResponse = {
      current_weather: {
        weathercode: weatherCode,
        temperature: temperature,
      },
    };

    const mockMovies = {
      Search: [{ imdbID: 'tt0000001', Title: 'Test Movie', Year: '2024', Poster: 'N/A' }],
    };

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(weatherResponse) })
      .mockResolvedValueOnce({ json: () => Promise.resolve(mockMovies) })
      .mockResolvedValue({ json: () => Promise.resolve({ Search: null }) });
  };

  it('maps clear sky (code 0-3) to "adventure" genre', async () => {
    setupWeatherMock(2, 20); // Clear sky, normal temp

    render(<App />);

    await waitFor(() => {
      // Verify fetch was called with "adventure" genre
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=adventure')
      );
    });
  });

  it('maps fog (code 45-48) to "mystery" genre', async () => {
    setupWeatherMock(45, 15); // Fog, normal temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=mystery')
      );
    });
  });

  it('maps hot temperature (>=30°C) to "action" genre', async () => {
    setupWeatherMock(20, 35); // Unknown code, hot temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=action')
      );
    });
  });

  it('maps drizzle/rain (code 51-67) to "romance" genre', async () => {
    setupWeatherMock(55, 18); // Drizzle, normal temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=romance')
      );
    });
  });

  it('maps snow (code 71-77) to "fantasy" genre', async () => {
    setupWeatherMock(73, -2); // Moderate snow, freezing temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=fantasy')
      );
    });
  });

  it('maps cold temperature (<=5°C) to "family" genre', async () => {
    setupWeatherMock(20, 3); // Unknown code, cold temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=family')
      );
    });
  });

  it('defaults to "drama" genre for unmatched conditions', async () => {
    setupWeatherMock(20, 15); // Unknown code, normal temp

    render(<App />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('s=drama')
      );
    });
  });
});
