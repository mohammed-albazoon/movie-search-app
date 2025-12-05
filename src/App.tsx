import { useState } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);

  const handleSearch = async () => {
    if (!query) return;

    let allMovies: any[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=thewdb&s=${query}&page=${page}`
      );
      const data = await response.json();

      if (!data.Search) break; // stop when no more movies

      allMovies = [...allMovies, ...data.Search];
      page++;

      // OMDB allows max up to 100 results (10 pages)
      if (page > 10) break;
    }

    setMovies(allMovies);
  };

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#141414',
        color: '#fff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h1 style={{ marginBottom: '1rem' }}>Movie Search App 🎬</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search for a movie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: 'none'
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            backgroundColor: '#e50914',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>

      <div
        style={{
          flex: 5,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '1rem',
          alignContent: 'start',
        }}
      >
        {movies.length > 0 ? (
          movies.map((movie) => (
            <div 
              key={movie.imdbID}
              onClick={() => window.open(`https://www.imdb.com/title/${movie.imdbID}`, "_blank")}
              style={{
                backgroundColor: '#222',
                borderRadius: '8px',
                overflow: 'hidden',
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >


              {movie.Poster !== 'N/A' && (
                <img
                  src={movie.Poster}
                  alt={movie.Title}
                  style={{
                    width: '100%',
                    height: '225px',
                    objectFit: 'cover',
                  }}
                />
              )}
              <div style={{ padding: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem' }}>{movie.Title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#aaa' }}>{movie.Year}</p>
              </div>
            </div>
          ))
        ) : (
          <p>No movies found.</p>
        )}
      </div>
    </div>
  );
}

export default App;
