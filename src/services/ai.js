import { buildAuthHeaders, readApiError } from './appAuth';

export async function getReadingEstimate({ title, currentPercent, avgSpeedPerDay, dateStarted }) {
  const response = await fetch('/api/ai-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    body: JSON.stringify({
      title,
      currentPercent,
      avgSpeedPerDay,
      dateStarted,
    }),
  });

  if (!response.ok) {
    throw await readApiError(response, 'AI request failed');
  }

  const data = await response.json().catch(() => null);
  return {
    text: data?.text || 'No estimate returned.',
    modelUsed: data?.modelUsed || '',
  };
}

export async function enrichBook({ bookId, title, author = '', isbn = '' }) {
  const response = await fetch('/api/enrich-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    body: JSON.stringify({ bookId, title, author, isbn }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw await readApiError(response, 'Book enrichment failed');
  }

  return {
    book: data?.book || null,
    enrichmentStatus: data?.enrichmentStatus || 'failed',
    sources: data?.sources || { openLibrary: 'error', ai: 'error' },
  };
}

export async function searchAiBooks({ query, signal }) {
  const response = await fetch('/api/ai-book-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    body: JSON.stringify({ query }),
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw await readApiError(response, 'AI book search failed');
  }

  return data?.books ?? [];
}
