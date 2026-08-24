import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import { getTodayPtDateKey } from '../utils/timezone';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36).slice(2) });

const fetchMock = vi.fn(async (input, init) => {
  const url = String(input);

  if (url === '/api/books' && (!init || !init.method || init.method === 'GET')) {
    return {
      ok: true,
      json: async () => ({ books: [] }),
    };
  }

  if (url === '/api/books' && init?.method === 'PUT') {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ books: body.books ?? [] }),
    };
  }

  if (url === '/api/enrich-book' && init?.method === 'POST') {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        book: {
          id: body.bookId,
          coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg',
          totalPages: 320,
          aiRecommendation: 'A gripping read with memorable characters and momentum.',
        },
        enrichmentStatus: 'success',
        sources: { openLibrary: 'ok', ai: 'ok' },
      }),
    };
  }

  if (url === '/api/ai-book-search' && init?.method === 'POST') {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        books: body.query === 'Yesteryear'
          ? [{
              key: 'curated-yesteryear-0',
              title: 'Yesteryear',
              author: 'Caro Claire Burke',
              publishYear: 2026,
              isbn: '',
              totalPages: null,
              coverUrl: '',
              source: 'curated',
            }]
          : body.query === 'No Library Match'
          ? [{
              key: 'ai-no-library-match-0',
              title: 'The Left Hand of Darkness',
              author: 'Ursula K. Le Guin',
              publishYear: 1969,
              isbn: '9780441478125',
              totalPages: 304,
              coverUrl: '',
              source: 'ai',
            }]
          : [],
      }),
    };
  }

  if (url.startsWith('https://openlibrary.org/search.json')) {
    const query = new URL(url).searchParams.get('q');
    return {
      ok: true,
      json: async () => ({
        docs: query === 'Dune'
          ? [{
              key: '/works/OL893415W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              isbn: ['9780441172719'],
              number_of_pages_median: 412,
              cover_i: 123,
            }]
          : [],
      }),
    };
  }

  return {
    ok: true,
    json: async () => ({ docs: [] }),
  };
});

vi.stubGlobal('fetch', fetchMock);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatAverageDaysYtdForCount(completedCount) {
  if (!completedCount) return 'Unavailable';

  const todayDateKey = getTodayPtDateKey();
  const today = parseDateKey(todayDateKey);
  const currentYear = Number(String(todayDateKey).slice(0, 4));
  const yearStart = parseDateKey(`${currentYear}-01-01`);

  if (!today || !yearStart) return 'Unavailable';

  const elapsedDays = Math.round((today - yearStart) / MS_PER_DAY) + 1;
  const value = elapsedDays / completedCount;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} days`;
}

function mockExistingPushSubscription() {
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
  });

  Object.defineProperty(window, 'Notification', {
    value: {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted'),
    },
    configurable: true,
  });

  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: vi.fn(async () => ({ endpoint: 'https://push.example/sub' })),
        },
      }),
    },
    configurable: true,
  });
}

async function renderApp() {
  render(<App />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading shared library/i)).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  localStorageMock.clear();
  fetchMock.mockClear();
});

describe('App', () => {
  it('renders the app header', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: /My Reading Goals/i })).toBeInTheDocument();
  });

  it('sends the stored app password when loading shared books', async () => {
    localStorageMock.setItem('bookmark-app-password', 'test-password');
    await renderApp();

    expect(fetchMock).toHaveBeenCalledWith('/api/books', {
      headers: { Authorization: 'Bearer test-password' },
    });
  });

  it('shows bottom navigation tabs', async () => {
    await renderApp();
    expect(screen.getByRole('tab', { name: /Currently Reading/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Want to Read/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Finished/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Settings/i })).toBeInTheDocument();
  });

  it('shows empty state on the Currently Reading tab when no books', async () => {
    await renderApp();
    expect(screen.getByText(/No books in progress/i)).toBeInTheDocument();
  });

  it('shows empty state on Want to Read tab when no books', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Want to Read/i }));
    expect(screen.getByText(/Your reading list is empty/i)).toBeInTheDocument();
  });

  it('shows empty state on Finished tab when no books', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Finished/i }));
    expect(screen.getByRole('heading', { name: /Reading Stats/i })).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText(/No books marked as read yet/i)).toBeInTheDocument();
  });

  it('opens the Add Book form when button clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
  });

  it('shows Open Library suggestions automatically while typing', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Search Open Library/i), { target: { value: 'Dune' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Use Dune by Frank Herbert/i })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://openlibrary.org/search.json?q=Dune'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses AI suggestions when Open Library has no matches', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Search Open Library/i), { target: { value: 'No Library Match' } });

    await waitFor(() => {
      expect(screen.getByText(/Showing AI suggestions/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Use The Left Hand of Darkness by Ursula K\. Le Guin/i }));

    expect(screen.getByLabelText(/Title \*/i)).toHaveValue('The Left Hand of Darkness');
    expect(screen.getByLabelText(/Author/i)).toHaveValue('Ursula K. Le Guin');
    expect(screen.getByLabelText(/Publish Year/i)).toHaveValue('1969');
    expect(screen.getByLabelText(/Total Pages/i)).toHaveValue('304');
  });

  it('uses the corrected author for Yesteryear when Open Library has no match', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Search Open Library/i), { target: { value: 'Yesteryear' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Use Yesteryear by Caro Claire Burke/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Use Yesteryear by Caro Claire Burke/i }));

    expect(screen.getByLabelText(/Title \*/i)).toHaveValue('Yesteryear');
    expect(screen.getByLabelText(/Author/i)).toHaveValue('Caro Claire Burke');
    expect(screen.getByLabelText(/Publish Year/i)).toHaveValue('2026');
  });

  it('adds a book to Want to Read list', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'The Great Gatsby' } });
    fireEvent.change(screen.getByLabelText(/Author/i), { target: { value: 'F. Scott Fitzgerald' } });
    // Status defaults to 'want-to-read'
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    expect(screen.getByText('The Great Gatsby')).toBeInTheDocument();
    expect(screen.getByText(/by F. Scott Fitzgerald/i)).toBeInTheDocument();
  });

  it('adds a book to Books Read list', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: '1984' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'read' } });
    fireEvent.change(screen.getByLabelText(/Date Read/i), { target: { value: '2024-03-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    expect(screen.getByText('1984')).toBeInTheDocument();
    expect(screen.getByText(/March 2024/i)).toBeInTheDocument();
  });

  it('shows reading stats and can collapse a finished month section', async () => {
    localStorageMock.setItem('reading-app-books', JSON.stringify([
      {
        id: 'finished-1',
        title: 'Project Hail Mary',
        author: 'Andy Weir',
        status: 'read',
        dateStarted: '2026-01-01',
        dateRead: '2026-01-11',
        totalPages: 476,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
      {
        id: 'finished-2',
        title: 'Orbital',
        author: 'Samantha Harvey',
        status: 'read',
        dateStarted: '2026-01-05',
        dateRead: '2026-01-08',
        totalPages: 136,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
      {
        id: 'finished-3',
        title: 'The Count of Monte Cristo',
        author: 'Alexandre Dumas',
        status: 'read',
        dateStarted: '2026-02-01',
        dateRead: '2026-02-20',
        totalPages: 1276,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
    ]));

    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Finished/i }));

    const year = Number(String(getTodayPtDateKey()).slice(0, 4));
    const expectedAverageDays = year === 2026 ? formatAverageDaysYtdForCount(3) : 'Unavailable';

    expect(screen.getByRole('heading', { name: /Reading Stats/i })).toBeInTheDocument();
    expect(screen.getByText(expectedAverageDays)).toBeInTheDocument();
    expect(screen.getByText('1.5 books')).toBeInTheDocument();
    expect(screen.getAllByText('The Count of Monte Cristo').length).toBeGreaterThan(0);
    expect(screen.getByText('1276 pages')).toBeInTheDocument();
    expect(screen.getAllByText('Orbital').length).toBeGreaterThan(0);
    expect(screen.getByText('136 pages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /January 2026/i }));

    expect(screen.queryByText('Project Hail Mary')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reading Stats/i })).toBeInTheDocument();
    expect(screen.getByText(expectedAverageDays)).toBeInTheDocument();
    expect(screen.getAllByText('The Count of Monte Cristo').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /January 2026/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('calculates average days when finished books are missing dateStarted', async () => {
    localStorageMock.setItem('reading-app-books', JSON.stringify([
      {
        id: 'finished-no-start-1',
        title: 'Book Without Start Date',
        author: 'A. Author',
        status: 'read',
        dateStarted: null,
        dateRead: '2026-03-03',
        totalPages: 240,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
      {
        id: 'finished-no-start-2',
        title: 'Another Finished Book',
        author: 'B. Author',
        status: 'read',
        dateStarted: null,
        dateRead: '2026-03-10',
        totalPages: 320,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
    ]));

    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Finished/i }));

    const year = Number(String(getTodayPtDateKey()).slice(0, 4));
    const expectedAverageDays = year === 2026 ? formatAverageDaysYtdForCount(2) : 'Unavailable';
    expect(screen.getByText(expectedAverageDays)).toBeInTheDocument();
  });

  it('edits finished book dates and re-groups by end date month', async () => {
    localStorageMock.setItem('reading-app-books', JSON.stringify([
      {
        id: 'finished-edit-1',
        title: 'The Dispossessed',
        author: 'Ursula K. Le Guin',
        status: 'read',
        dateStarted: '2026-01-02',
        dateRead: '2026-01-15',
        totalPages: 341,
        progressLog: [],
        currentPercent: 100,
        enrichmentStatus: 'ready',
        timeZoneVersion: 'pt-v2',
      },
    ]));

    await renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Finished/i }));

    expect(screen.getByRole('button', { name: /January 2026/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /More actions for "The Dispossessed"/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edit details for "The Dispossessed"/i }));

    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2026-02-12' } });
    fireEvent.click(screen.getByRole('button', { name: /^Update$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /February 2026/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /January 2026/i })).not.toBeInTheDocument();
  });

  it('adds a book to Currently Reading list', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    expect(screen.getByLabelText(/Date Started/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Date Started/i), { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.getByText(/Started Apr 1, 2026/i)).toBeInTheDocument();
    // Should show progress bar at 0%
    expect(screen.getByText('0%')).toBeInTheDocument();
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([url, init]) => url === '/api/books' && init?.method === 'PUT');
      const savedDune = putCalls
        .flatMap(([, init]) => JSON.parse(init.body).books)
        .find((book) => book.title === 'Dune');
      expect(savedDune?.dateStarted).toBe('2026-04-01');
    });
  });

  it('logs daily reading progress', async () => {
    await renderApp();
    // Add a currently-reading book
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    // Open log form and log 45%
    fireEvent.click(screen.getByRole('button', { name: /Open log entry for "Dune"/i }));
    const input = screen.getByLabelText(/Log current reading percentage for "Dune"/i);
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Log/i }));

    expect(screen.getByRole('progressbar', { name: /45% read/i })).toBeInTheDocument();
  });

  it('converts an in-progress value when switching units and persists the chosen unit', async () => {
    await renderApp();
    // Add a currently-reading book with a known page count
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune' } });
    fireEvent.change(screen.getByLabelText(/Total Pages/i), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('button', { name: /Open log entry for "Dune"/i }));
    const percentInput = screen.getByLabelText(/Log current reading percentage for "Dune"/i);
    fireEvent.change(percentInput, { target: { value: '50' } });

    fireEvent.click(screen.getByRole('radio', { name: 'Pages' }));

    const pageInput = screen.getByLabelText(/Log current page for "Dune", out of 400 pages/i);
    expect(pageInput).toHaveValue(200);

    fireEvent.click(screen.getByRole('button', { name: /Save Log/i }));

    expect(screen.getByText('Page 200 of 400')).toBeInTheDocument();

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([url, init]) => url === '/api/books' && init?.method === 'PUT');
      const lastCall = putCalls[putCalls.length - 1];
      const savedDune = JSON.parse(lastCall[1].body).books.find((book) => book.title === 'Dune');
      expect(savedDune?.progressUnit).toBe('pages');
    });
  });

  it('shows validation error for invalid progress percentage', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('button', { name: /Open log entry for "Dune"/i }));
    const input = screen.getByLabelText(/Log current reading percentage for "Dune"/i);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Log/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/0.{1,3}100/i);
  });

  it('can start reading a want-to-read book', async () => {
    await renderApp();
    // Add a want-to-read book
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Moby Dick' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    // Navigate to want tab
    fireEvent.click(screen.getByRole('tab', { name: /Want to Read/i }));
    fireEvent.click(screen.getByRole('button', { name: /More actions for "Moby Dick"/i }));
    expect(screen.queryByRole('button', { name: /Mark "Moby Dick" as finished/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start reading "Moby Dick"/i }));

    // Should now be in Currently Reading
    expect(screen.getByText('Moby Dick')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('can mark a want-to-read book as read from the overflow menu', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Kindred' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('tab', { name: /Want to Read/i }));
    fireEvent.click(screen.getByRole('button', { name: /More actions for "Kindred"/i }));
    expect(screen.queryByRole('button', { name: /Mark "Kindred" as finished/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark "Kindred" as read/i }));

    expect(screen.getByText('Kindred')).toBeInTheDocument();
  });

  it('marks a currently-reading book as finished', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('button', { name: /More actions for "Dune"/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark "Dune" as finished/i }));

    // Should move to Books Read tab
    expect(screen.getByText('Dune')).toBeInTheDocument();
  });

  it('shows validation error when title is empty', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Title is required/i);
  });

  it('closes the form when Cancel is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can delete a book', async () => {
    await renderApp();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Add a want-to-read book then navigate to want tab
    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Brave New World' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    expect(screen.getByText('Brave New World')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /More actions for "Brave New World"/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete "Brave New World"/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText('Brave New World')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('keeps a book when delete confirmation is canceled', async () => {
    await renderApp();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Never Let Me Go' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('button', { name: /More actions for "Never Let Me Go"/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete "Never Let Me Go"/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Never Let Me Go"?');
    expect(screen.getAllByText('Never Let Me Go').length).toBeGreaterThan(0);
    confirmSpy.mockRestore();
  });

  it('warns before deleting a currently reading book', async () => {
    await renderApp();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: /Add a new book/i }));
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Dune Messiah' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'currently-reading' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Book/i }));

    fireEvent.click(screen.getByRole('button', { name: /More actions for "Dune Messiah"/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete "Dune Messiah" from your library/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Dune Messiah"? This will also clear its reading progress.');
    expect(screen.getAllByText('Dune Messiah').length).toBeGreaterThan(0);
    confirmSpy.mockRestore();
  });

  it('shows reminders as enabled when a subscription already exists', async () => {
    mockExistingPushSubscription();
    await renderApp();

    fireEvent.click(screen.getByRole('tab', { name: /Settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enable reading reminders/i })).toHaveTextContent('Reminders Enabled');
    });
  });
});
