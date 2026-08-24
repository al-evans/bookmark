const BOOKS_KEY = process.env.BOOKS_KV_KEY || 'reading-app:books';

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBook(book) {
  const progressLog = Array.isArray(book?.progressLog)
    ? book.progressLog.map((entry) => ({
        date: typeof entry?.date === 'string' ? entry.date : '',
        currentPercent: Math.min(100, Math.max(0, toNumber(entry?.currentPercent ?? entry?.percentage) ?? 0)),
      }))
    : [];

  const totalPages = toNumber(book?.totalPages);
  const recommendation = normalizeText(book?.aiRecommendation);

  return {
    id: typeof book?.id === 'string' && book.id.trim() ? book.id.trim() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: normalizeText(book?.title),
    author: normalizeText(book?.author),
    isbn: typeof book?.isbn === 'string' ? book.isbn.trim() : '',
    publishYear: typeof book?.publishYear === 'string' ? book.publishYear.trim() : '',
    coverUrl: typeof book?.coverUrl === 'string' ? book.coverUrl.trim() : '',
    aiRecommendation: recommendation || null,
    status: ['want-to-read', 'currently-reading', 'read'].includes(book?.status) ? book.status : 'want-to-read',
    dateStarted: typeof book?.dateStarted === 'string' && book.dateStarted ? book.dateStarted : null,
    dateRead: typeof book?.dateRead === 'string' && book.dateRead ? book.dateRead : null,
    progressLog,
    totalPages: totalPages && totalPages > 0 ? Math.round(totalPages) : null,
    currentPercent: Math.min(100, Math.max(0, toNumber(book?.currentPercent) ?? (progressLog.at(-1)?.currentPercent ?? 0))),
    timeZoneVersion: book?.timeZoneVersion === 'pt-v2' ? 'pt-v2' : 'legacy-utc',
  };
}

export function normalizeBooksPayload(payload) {
  if (!Array.isArray(payload)) {
    return null;
  }

  const books = payload.map(normalizeBook).filter((book) => book.title);
  const uniqueBooks = [];
  const seen = new Set();

  for (const book of books) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    uniqueBooks.push(book);
  }

  return uniqueBooks;
}

export async function kvCommand(command) {
  const apiUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!apiUrl || !token) {
    const error = new Error(
      'Storage is not connected. Add a Redis store to this Vercel project.'
    );
    error.code = 'KV_NOT_CONFIGURED';
    throw error;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`KV request failed (${response.status}). ${errorText}`.trim());
  }

  const data = await response.json();

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.result;
}

export async function getJsonFromKv(key, fallback = null) {
  const raw = await kvCommand(['GET', key]);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveJsonToKv(key, value) {
  await kvCommand(['SET', key, JSON.stringify(value)]);
  return value;
}

export async function getBooksFromKv() {
  const parsed = await getJsonFromKv(BOOKS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveBooksToKv(books) {
  await kvCommand(['SET', BOOKS_KEY, JSON.stringify(books)]);
  return books;
}

export async function fetchOpenLibraryFacts({ title, author = '', isbn = '' }) {
  const trimmedIsbn = normalizeText(isbn).replace(/[^0-9Xx]/g, '');
  const trimmedTitle = normalizeText(title).slice(0, 180);
  const trimmedAuthor = normalizeText(author).slice(0, 120);

  const query = trimmedIsbn
    ? `isbn:${trimmedIsbn}`
    : normalizeText(`${trimmedTitle} ${trimmedAuthor}`);

  if (!query) {
    return { coverUrl: '', pageCount: null };
  }

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Open Library request failed.');
  }

  const data = await response.json();
  const doc = Array.isArray(data?.docs) ? data.docs[0] : null;
  if (!doc) {
    return { coverUrl: '', pageCount: null };
  }

  const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '';
  const pageCount = Number.isFinite(doc.number_of_pages_median) ? Math.round(doc.number_of_pages_median) : null;

  return { coverUrl, pageCount };
}
