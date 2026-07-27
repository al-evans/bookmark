import { getBooksFromKv, normalizeBooksPayload, saveBooksToKv } from './_lib/books.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const books = await getBooksFromKv();
      return res.status(200).json({ books });
    } catch (error) {
      return res.status(503).json({ error: error?.message || 'Could not load books.' });
    }
  }

  if (req.method === 'PUT') {
    const books = normalizeBooksPayload(req.body?.books);

    if (!books) {
      return res.status(400).json({ error: 'Invalid books payload.' });
    }

    try {
      await saveBooksToKv(books);
      return res.status(200).json({ books });
    } catch (error) {
      return res.status(503).json({ error: error?.message || 'Could not save books.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed.' });
}
