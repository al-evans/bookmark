export async function getReadingEstimate({ title, currentPercent, avgSpeedPerDay, dateStarted }) {
  const response = await fetch('/api/ai-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      currentPercent,
      avgSpeedPerDay,
      dateStarted,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'AI request failed');
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId, title, author, isbn }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Book enrichment failed');
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'AI book search failed');
  }

  return data?.books ?? [];
}
