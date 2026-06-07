export function SearchForm() {
  const query = ''
  const page = 1

  return (
    <div>
      <div>
        <label htmlFor="search">Search: </label>
        <input
          id="search"
          data-testid="search-input"
          type="text"
          value={query}
          placeholder="Type a query..."
        />
      </div>
      <div>
        <p data-testid="current-query">Query: {query || '(empty)'}</p>
        <p data-testid="current-page">Page: {page}</p>
        <button data-testid="prev-page">Previous</button>
        <button data-testid="text-page">Text</button>
      </div>
    </div>
  )
}
