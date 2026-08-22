import { normalizeBookSearchQuery, searchBooksWithAi } from './_lib/aiBookSearch.js';
import { requireAppAuth } from './_lib/appAuth.js';
import { aiRequestFailedMessage } from './_lib/aiProvider.js';

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireAppAuth(req, res) !== true) return undefined;

  const query = normalizeBookSearchQuery(req.body?.query);
  if (!query) {
    return res.status(400).json({ error: 'Enter a title or author to search.' });
  }

  try {
    const books = await searchBooksWithAi(query);
    return res.json({ books });
  } catch (error) {
    const message = error?.message || aiRequestFailedMessage();
    const status = message.includes('key missing') ? 503 : 502;
    return res.status(status).json({ error: message });
  }
}
