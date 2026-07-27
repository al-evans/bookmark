import { useEffect, useRef, useState } from 'react';
import { searchAiBooks } from '../services/ai';
import { PT_TIME_ZONE_VERSION, getTodayPtDateKey } from '../utils/timezone';

const today = () => getTodayPtDateKey();
const normalizeText = (input) => input.replace(/\s+/g, ' ').trim();
const makeId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const hasLatinLetters = (text) => /[A-Za-z]/.test(text ?? '');

function resolveOpenLibraryDoc(doc) {
  const workTitle = normalizeText(doc.title ?? '');
  // Open Library sometimes returns the work's title in a non-Latin script
  // (e.g. the Greek "Ὀδύσσεια" for The Odyssey). When that happens, prefer the
  // matched edition's title, which is typically the Latin-script edition title.
  const edition = doc.editions?.docs?.[0];
  const editionTitle = normalizeText(edition?.title ?? '');
  const preferEdition = editionTitle && !hasLatinLetters(workTitle) && hasLatinLetters(editionTitle);

  const title = preferEdition ? editionTitle : workTitle;
  const isbn = (preferEdition ? edition?.isbn?.[0] : null) ?? doc.isbn?.[0] ?? '';
  const coverId = (preferEdition ? edition?.cover_i : null) ?? doc.cover_i;

  return {
    key: doc.key,
    title,
    author: normalizeText(doc.author_name?.[0] ?? ''),
    publishYear: doc.first_publish_year ?? null,
    isbn,
    totalPages: Number.isFinite(doc.number_of_pages_median) ? doc.number_of_pages_median : null,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '',
    source: 'openLibrary',
  };
}

async function searchOpenLibrary(query, signal) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,first_publish_year,isbn,number_of_pages_median,cover_i,editions`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Open Library search failed');
  }
  const data = await response.json();
  return (data.docs ?? []).map(resolveOpenLibraryDoc);
}

async function searchBooks(query, signal) {
  const openLibraryResults = await searchOpenLibrary(query, signal);
  if (openLibraryResults.length > 0) {
    return { results: openLibraryResults, source: 'openLibrary' };
  }

  const aiResults = await searchAiBooks({ query, signal });
  return { results: aiResults, source: 'ai' };
}

export default function AddBookForm({ onAdd, onClose }) {
  const formRef = useRef(null);
  const searchBoxRef = useRef(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publishYear, setPublishYear] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState('want-to-read');
  const [dateStarted, setDateStarted] = useState(today());
  const [dateRead, setDateRead] = useState(today());
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchState, setSearchState] = useState({ loading: false, error: '', source: '' });

  useEffect(() => {
    const handleOutsideTap = (event) => {
      if (!searchResults.length) return;
      if (searchBoxRef.current?.contains(event.target)) return;
      setSearchResults([]);
    };

    document.addEventListener('mousedown', handleOutsideTap);
    document.addEventListener('touchstart', handleOutsideTap);

    return () => {
      document.removeEventListener('mousedown', handleOutsideTap);
      document.removeEventListener('touchstart', handleOutsideTap);
    };
  }, [searchResults.length]);

  const runSearch = async () => {
    const query = normalizeText(searchTerm || `${title} ${author}`);
    if (!query) {
      setSearchState({ loading: false, error: 'Enter a title or author to search.', source: '' });
      return;
    }

    setSearchState({ loading: true, error: '', source: '' });
    try {
      const { results, source } = await searchBooks(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchState({ loading: false, error: 'No books found.', source: '' });
        return;
      }
      setSearchState({ loading: false, error: '', source });
    } catch {
      setSearchState({ loading: false, error: 'Could not search book sources right now.', source: '' });
    }
  };

  useEffect(() => {
    const query = normalizeText(searchTerm);
    if (query.length < 2) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState({ loading: true, error: '', source: '' });
      try {
        const { results, source } = await searchBooks(query, controller.signal);
        if (controller.signal.aborted) return;
        setSearchResults(results);
        setSearchState({
          loading: false,
          error: results.length ? '' : 'No books found.',
          source: results.length ? source : '',
        });
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setSearchResults([]);
        setSearchState({ loading: false, error: 'Could not search book sources right now.', source: '' });
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const applySearchResult = (result) => {
    setTitle(result.title || title);
    setAuthor(result.author || author);
    setPublishYear(result.publishYear ? String(result.publishYear) : '');
    setTotalPages(result.totalPages ? String(result.totalPages) : totalPages);
    setIsbn(result.isbn || '');
    setCoverUrl(result.coverUrl || '');
    setError('');
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const normalizedTitle = normalizeText(title);
    const normalizedAuthor = normalizeText(author);
    if (!normalizedTitle) {
      setError('Title is required.');
      return;
    }

    const initialPercent = status === 'read' ? 100 : 0;
    const safeTotalPages = Number(totalPages);

    try {
      onAdd({
        id: makeId(),
        title: normalizedTitle,
        author: normalizedAuthor,
        isbn: isbn.trim(),
        publishYear: publishYear.trim(),
        totalPages: Number.isFinite(safeTotalPages) && safeTotalPages > 0 ? Math.round(safeTotalPages) : null,
        coverUrl: coverUrl.trim(),
        status,
        dateStarted: status === 'currently-reading' ? dateStarted : null,
        dateRead: status === 'read' ? dateRead : null,
        progressLog: [],
        currentPercent: initialPercent,
        timeZoneVersion: PT_TIME_ZONE_VERSION,
      });
      onClose();
    } catch {
      setError('Could not add book right now. Please try again.');
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchResults([]);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    runSearch();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="form-title">Add a Book</h2>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close form"
          >
            ✕
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="modal-form-container add-book-form">
          <div className="form-scroll-content add-book-form__scroll">
            <section className="add-book-form__search" ref={searchBoxRef}>
            <div className="add-book-form__search-header">
              <label htmlFor="searchTerm" className="add-book-form__section-label">Search Open Library</label>
              <p className="add-book-form__section-note">Start with a title or author to prefill the details.</p>
            </div>
            <div className="search-row add-book-form__search-row">
              <input
                id="searchTerm"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSearchTerm(nextValue);
                  if (normalizeText(nextValue).length < 2) {
                    setSearchResults([]);
                    setSearchState({ loading: false, error: '', source: '' });
                    return;
                  }
                  setSearchState((prev) => ({ ...prev, error: '' }));
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Try: Dune or Frank Herbert"
                autoFocus
                aria-describedby={searchState.error ? 'search-error' : undefined}
              />
              <button type="button" className="btn-secondary add-book-form__search-button" onClick={runSearch} disabled={searchState.loading}>
                {searchState.loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchState.error && <p id="search-error" className="form-error" role="alert">{searchState.error}</p>}
            {searchState.source === 'ai' && !searchState.loading && !searchState.error && (
              <p className="search-source-note">No Open Library match. Showing AI suggestions.</p>
            )}
            {searchState.loading && (
              <div className="search-skeleton" aria-hidden="true">
                <div className="search-skeleton-row" />
                <div className="search-skeleton-row" />
                <div className="search-skeleton-row" />
              </div>
            )}
            {searchResults.length > 0 && (
              <ul className="search-results" aria-label="Book search results">
              {searchResults.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    className="search-result-btn"
                    onClick={() => applySearchResult(result)}
                    aria-label={`Use ${result.title} by ${result.author || 'unknown author'}`}
                  >
                    <span>{result.title}</span>
                    <small>{result.author || 'Unknown author'}{result.publishYear ? ` · ${result.publishYear}` : ''}{result.source === 'ai' ? ' · AI' : ''}</small>
                  </button>
                </li>
              ))}
              </ul>
            )}
          </section>

          <section className="add-book-form__details">
            <div className="add-book-form__details-header">
              <p className="add-book-form__section-label">Book details</p>
            </div>

            <div className="add-book-form__grid">
              <div className="add-book-form__field add-book-form__field--full">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Book title"
                />
                {error && <p className="form-error" role="alert">{error}</p>}
              </div>

              <div className="add-book-form__field add-book-form__field--full">
                <label htmlFor="author">Author</label>
                <input
                  id="author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author name"
                />
              </div>

              <div className="add-book-form__field">
                <label htmlFor="publishYear">Publish Year</label>
                <input
                  id="publishYear"
                  type="text"
                  value={publishYear}
                  onChange={(e) => setPublishYear(e.target.value)}
                  placeholder="e.g. 1997"
                />
              </div>

              <div className="add-book-form__field">
                <label htmlFor="isbn">ISBN</label>
                <input
                  id="isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="ISBN (optional)"
                />
              </div>

              <div className="add-book-form__field">
                <label htmlFor="totalPages">Total Pages</label>
                <input
                  id="totalPages"
                  type="text"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  placeholder="e.g. 412"
                />
              </div>

              <div className="add-book-form__field">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="want-to-read">Want to Read</option>
                  <option value="currently-reading">Currently Reading</option>
                  <option value="read">Read</option>
                </select>
              </div>

              {status === 'currently-reading' && (
                <div className="add-book-form__field add-book-form__field--full">
                  <label htmlFor="dateStarted">Date Started</label>
                  <input
                    id="dateStarted"
                    type="date"
                    value={dateStarted}
                    onChange={(e) => setDateStarted(e.target.value)}
                  />
                </div>
              )}

              {status === 'read' && (
                <div className="add-book-form__field add-book-form__field--full">
                  <label htmlFor="dateRead">Date Read</label>
                  <input
                    id="dateRead"
                    type="date"
                    value={dateRead}
                    onChange={(e) => setDateRead(e.target.value)}
                  />
                </div>
              )}

              <div className="add-book-form__field add-book-form__field--full">
                <label htmlFor="coverUrl">Cover URL</label>
                <input
                  id="coverUrl"
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </section>
          </div>

          <div className="form-actions add-book-form__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-log">Add Book</button>
          </div>
        </form>
      </div>
    </div>
  );
}
