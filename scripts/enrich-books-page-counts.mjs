#!/usr/bin/env node
/**
 * Enrich books with page counts from Open Library
 * Usage: node scripts/enrich-books-page-counts.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOKS_FILE = path.join(__dirname, '../server/data/books.json');

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

async function fetchOpenLibraryFacts({ title, author = '', isbn = '' }) {
  const trimmedIsbn = normalizeText(isbn).replace(/[^0-9Xx]/g, '');
  const trimmedTitle = normalizeText(title).slice(0, 180);
  const trimmedAuthor = normalizeText(author).slice(0, 120);

  const query = trimmedIsbn
    ? `isbn:${trimmedIsbn}`
    : normalizeText(`${trimmedTitle} ${trimmedAuthor}`);

  if (!query) {
    return { pageCount: null };
  }

  const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;

  try {
    // Step 1: Search for the work key
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.warn(`Open Library search failed for "${title}"`);
      return { pageCount: null };
    }

    const searchData = await searchResponse.json();
    const doc = Array.isArray(searchData?.docs) ? searchData.docs[0] : null;

    if (!doc || !doc.key) {
      console.warn(`No results found for "${title}"`);
      return { pageCount: null };
    }

    // Step 2: Get editions for this work to find page count
    const workKey = doc.key.replace(/^\/works\//, '');
    const editionsUrl = `https://openlibrary.org/works/${workKey}/editions.json`;

    const editionsResponse = await fetch(editionsUrl);

    if (!editionsResponse.ok) {
      console.warn(`Failed to fetch editions for "${title}"`);
      return { pageCount: null };
    }

    const editionsData = await editionsResponse.json();
    const editions = Array.isArray(editionsData?.entries) ? editionsData.entries : [];

    if (editions.length === 0) {
      console.warn(`No editions found for "${title}"`);
      return { pageCount: null };
    }

    // Find the most common page count (median-ish approach)
    const pageCounts = editions
      .map((e) => e.number_of_pages)
      .filter((p) => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b);

    if (pageCounts.length === 0) {
      console.warn(`No page counts found in editions for "${title}"`);
      return { pageCount: null };
    }

    // Use median page count
    const medianPageCount = pageCounts[Math.floor(pageCounts.length / 2)];
    return { pageCount: medianPageCount };
  } catch (error) {
    console.error(`Error fetching data for "${title}":`, error.message);
    return { pageCount: null };
  }
}

async function enrichBooks() {
  try {
    // Read books file
    const booksData = fs.readFileSync(BOOKS_FILE, 'utf8');
    let books = JSON.parse(booksData);

    console.log(`\n📚 Found ${books.length} books\n`);

    let updated = 0;
    let skipped = 0;

    // Process each book
    for (const book of books) {
      // Skip if already has page count
      if (book.totalPages && Number.isFinite(book.totalPages) && book.totalPages > 0) {
        console.log(`✓ ${book.title} (already has ${book.totalPages} pages)`);
        skipped++;
        continue;
      }

      console.log(`🔍 Looking up: ${book.title}`);

      // Fetch from Open Library
      const { pageCount } = await fetchOpenLibraryFacts({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
      });

      if (pageCount) {
        book.totalPages = pageCount;
        console.log(`   ✓ Found: ${pageCount} pages\n`);
        updated++;
      } else {
        console.log(`   ✗ No page count found\n`);
      }

      // Add delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Write updated books back to file
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));

    console.log(`\n✅ Done!\n   Updated: ${updated} books\n   Already had data: ${skipped} books\n`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

enrichBooks();
