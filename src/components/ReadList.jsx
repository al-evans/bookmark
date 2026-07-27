import { useId, useState } from 'react';
import BookCard from './BookCard';
import { formatPtMonthYearFromDateKey, getTodayPtDateKey } from '../utils/timezone';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatAverage(value, unit) {
  if (!Number.isFinite(value)) return 'Unavailable';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} ${unit}`;
}

function getAverageDaysPerBookYearToDate(readBooks) {
  const todayDateKey = getTodayPtDateKey();
  const today = parseDateKey(todayDateKey);
  if (!today || typeof todayDateKey !== 'string') return null;

  const year = Number(todayDateKey.slice(0, 4));
  if (!year) return null;

  const yearStart = parseDateKey(`${year}-01-01`);
  if (!yearStart) return null;

  const booksCompletedThisYear = readBooks.filter((book) => {
    const finishedAt = parseDateKey(book.dateRead);
    if (!finishedAt) return false;
    const finishedYear = Number(String(book.dateRead).slice(0, 4));
    return finishedYear === year && finishedAt <= today;
  });

  if (!booksCompletedThisYear.length) return null;

  const elapsedDays = Math.round((today - yearStart) / MS_PER_DAY) + 1;
  return elapsedDays / booksCompletedThisYear.length;
}

function getMonthYear(dateStr) {
  if (!dateStr) return 'Unknown';
  return formatPtMonthYearFromDateKey(dateStr);
}

function groupByMonthYear(books) {
  const groups = {};
  books.forEach((book) => {
    const key = getMonthYear(book.dateRead);
    if (!groups[key]) groups[key] = { label: key, date: book.dateRead || '', books: [] };
    groups[key].books.push(book);
  });

  return Object.values(groups)
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    })
    .map((group) => (
      {
        ...group,
        books: group.books.sort((a, b) => new Date(b.dateRead || '') - new Date(a.dateRead || '')),
      }
    ));
}

function getPageCount(book) {
  return Number.isFinite(book.totalPages) && book.totalPages > 0 ? book.totalPages : null;
}

function pickByPageCount(books, direction) {
  const booksWithPages = books.filter((book) => getPageCount(book) !== null);
  if (booksWithPages.length === 0) return null;

  return booksWithPages.reduce((selected, book) => {
    if (!selected) return book;
    const selectedPages = getPageCount(selected);
    const bookPages = getPageCount(book);
    return direction === 'max'
      ? (bookPages > selectedPages ? book : selected)
      : (bookPages < selectedPages ? book : selected);
  }, null);
}

function getReadingStats(readBooks) {
  const booksWithFinishedDate = readBooks.filter((book) => book.dateRead);
  const monthKeys = new Set(booksWithFinishedDate.map((book) => book.dateRead.slice(0, 7)));

  return {
    averageDaysToRead: getAverageDaysPerBookYearToDate(readBooks),
    averageBooksPerMonth: monthKeys.size ? booksWithFinishedDate.length / monthKeys.size : null,
    longestBook: pickByPageCount(readBooks, 'max'),
    shortestBook: pickByPageCount(readBooks, 'min'),
  };
}

export default function ReadList({ books, onDelete, onEditPageCount }) {
  const readBooks = books.filter((b) => b.status === 'read');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const readSectionId = useId();
  const groups = groupByMonthYear(readBooks);
  const stats = getReadingStats(readBooks);
  const statsPanelId = `${readSectionId}-stats-panel`;

  function isGroupExpanded(groupLabel) {
    return expandedGroups[groupLabel] ?? true;
  }

  function toggleGroup(groupLabel) {
    setExpandedGroups((current) => ({
      ...current,
      [groupLabel]: !(current[groupLabel] ?? true),
    }));
  }

  return (
    <section className="book-section" aria-labelledby="read-heading">
      <div className="read-section-header">
        <h2 id="read-heading">Books I&apos;ve Read <span className="count">({readBooks.length})</span></h2>
      </div>

      <div className="read-section-content">
        <section className="read-stats" aria-labelledby={`${readSectionId}-stats-heading`}>
          <div className="read-stats__header">
            <h3 id={`${readSectionId}-stats-heading`}>Reading Stats</h3>
            <button
              type="button"
              className="read-stats__toggle"
              aria-expanded={isStatsExpanded}
              aria-controls={statsPanelId}
              onClick={() => setIsStatsExpanded((current) => !current)}
            >
              {isStatsExpanded ? 'Hide Stats' : 'Show Stats'}
            </button>
          </div>

          {isStatsExpanded && (
            <dl id={statsPanelId} className="read-stats__grid">
              <div className="read-stat-card">
                <dt>Average days per book</dt>
                <dd>{formatAverage(stats.averageDaysToRead, 'days')}</dd>
              </div>
              <div className="read-stat-card">
                <dt>Average books per month</dt>
                <dd>{formatAverage(stats.averageBooksPerMonth, 'books')}</dd>
              </div>
              <div className="read-stat-card">
                <dt>Longest read book</dt>
                <dd>{stats.longestBook ? stats.longestBook.title : 'Unavailable'}</dd>
                {stats.longestBook && <p>{getPageCount(stats.longestBook)} pages</p>}
              </div>
              <div className="read-stat-card">
                <dt>Shortest read book</dt>
                <dd>{stats.shortestBook ? stats.shortestBook.title : 'Unavailable'}</dd>
                {stats.shortestBook && <p>{getPageCount(stats.shortestBook)} pages</p>}
              </div>
            </dl>
          )}
        </section>

        {readBooks.length === 0 ? (
            <p className="empty-state">No books marked as read yet. Start adding some!</p>
        ) : (
          groups.map((group) => {
            const groupExpanded = isGroupExpanded(group.label);
            const groupPanelId = `${readSectionId}-${group.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-panel`;

            return (
              <section key={group.label} className="month-group" aria-labelledby={`${groupPanelId}-label`}>
                <button
                  type="button"
                  id={`${groupPanelId}-label`}
                  className="month-toggle"
                  aria-expanded={groupExpanded}
                  aria-controls={groupPanelId}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="month-toggle__copy">
                    <span className="month-label">{group.label}</span>
                    <span className="month-toggle__count">{group.books.length} {group.books.length === 1 ? 'book' : 'books'}</span>
                  </span>
                  <span className={`month-toggle__arrow ${groupExpanded ? 'month-toggle__arrow--expanded' : ''}`} aria-hidden="true">
                    v
                  </span>
                </button>

                {groupExpanded && (
                  <ul id={groupPanelId} className="book-list">
                    {group.books.map((book) => (
                      <li key={book.id}>
                        <BookCard book={book} onDelete={onDelete} onEditPageCount={onEditPageCount} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
