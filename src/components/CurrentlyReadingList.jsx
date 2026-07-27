import { useState } from 'react';
import { Check, Clock3, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  calcAvgSpeedPercentPerDay,
  estimateDaysRemaining,
  getCurrentPercent,
} from '../utils/progress';
import { confirmDeleteBook } from '../utils/deleteConfirmation';
import { formatPtFriendlyDate, formatPtFriendlyDateKey } from '../utils/timezone';

const MIN_LOGS_FOR_ESTIMATE = 3;

function ProgressBar({ percentage, variant = 'classic' }) {
  return (
    <div className={`progress-bar-track progress-bar-track--${variant}`} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${percentage}% read`}>
      <div className={`progress-bar-fill progress-bar-fill--${variant}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

function BookProgressCard({ book, onLogProgress, onMarkRead, onDelete, onEditPageCount, progressBarStyle }) {
  const [inputPct, setInputPct] = useState('');
  const [error, setError] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogEntryOpen, setIsLogEntryOpen] = useState(false);

  const logCount = book.progressLog?.length ?? 0;
  const currentPct = getCurrentPercent(book.progressLog, book.currentPercent ?? 0);
  const displayPct = Math.round(currentPct);
  const showEstimate = logCount >= MIN_LOGS_FOR_ESTIMATE;
  const avgSpeedPerDay = showEstimate ? calcAvgSpeedPercentPerDay(book.progressLog ?? []) : 0;
  const daysRemaining = showEstimate ? estimateDaysRemaining(currentPct, avgSpeedPerDay) : null;
  const showCoverSkeleton = !book.coverUrl && book.enrichmentStatus === 'pending';

  const handleLog = (e) => {
    e.preventDefault();
    const pct = Number(inputPct);
    if (isNaN(pct) || inputPct === '' || pct < 0 || pct > 100) {
      setError('Enter a number 0–100');
      return;
    }
    if (pct < currentPct) {
      setError('Current progress cannot be less than your latest entry.');
      return;
    }
    onLogProgress(book.id, pct);
    setInputPct('');
    setError('');
    setIsLogEntryOpen(false);
    setIsHistoryOpen(true);
  };

  return (
    <div className="book-card book-card--progress">
      {book.coverUrl && (
        <img className="book-cover" src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" />
      )}
      {showCoverSkeleton && (
        <div className="book-cover book-cover-skeleton" aria-label={`Loading cover for ${book.title}`} />
      )}
      <div className="book-info">
        <span className="book-title">{book.title}</span>
        {book.author && <span className="book-author">by {book.author}</span>}
        {book.publishYear && (
          <span className="book-meta">Published {book.publishYear}</span>
        )}
        <div className="progress-row">
          <ProgressBar percentage={displayPct} variant={progressBarStyle} />
          <span className="progress-pct">{displayPct}%</span>
        </div>
        {showEstimate && daysRemaining !== null && (
          <p className="estimate-text">
              {`Estimated ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining at ${avgSpeedPerDay.toFixed(2)}% a day.`}
          </p>
        )}
        {!showEstimate && (
          <p className="estimate-text estimate-text--muted">
            {`Log ${MIN_LOGS_FOR_ESTIMATE - logCount} more day${MIN_LOGS_FOR_ESTIMATE - logCount === 1 ? '' : 's'} of progress to see an estimate.`}
          </p>
        )}
        {book.dateStarted && (
          <p className="estimate-text">Started {formatPtFriendlyDateKey(book.dateStarted) || book.dateStarted}</p>
        )}
        {!isLogEntryOpen ? (
          <button
            type="button"
            className="btn-log btn-log-toggle"
            onClick={() => {
              setError('');
              setIsLogEntryOpen(true);
            }}
            aria-label={`Open log entry for "${book.title}"`}
          >
            Log
          </button>
        ) : (
          <form className="progress-form" onSubmit={handleLog} noValidate>
            <input
              type="number"
              inputMode="numeric"
              className="progress-input"
              min="0"
              max="100"
              value={inputPct}
              onChange={(e) => { setInputPct(e.target.value); setError(''); }}
              placeholder="Current % read"
              aria-label={`Log current reading percentage for "${book.title}"`}
              autoFocus
            />
            <div className="progress-form__actions">
              <button
                type="button"
                className="btn-secondary btn-log-cancel"
                onClick={() => {
                  setError('');
                  setInputPct('');
                  setIsLogEntryOpen(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-log">Save Log</button>
            </div>
          </form>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="book-actions book-actions--top" aria-label={`Top actions for "${book.title}"`}>
        {book.progressLog?.length > 0 && (
          <button
            type="button"
            className="btn-quiet-icon"
            aria-label={`View progress history for "${book.title}"`}
            title="Progress history"
            onClick={() => {
              setIsMenuOpen(false);
              setIsHistoryOpen((open) => !open);
            }}
          >
            <Clock3 size={17} aria-hidden="true" />
            <span className="sr-only">Progress history</span>
          </button>
        )}

        <button
          type="button"
          className="btn-quiet-icon"
          aria-label={`More actions for "${book.title}"`}
          title="More actions"
          onClick={() => setIsMenuOpen(true)}
        >
          <MoreVertical size={18} aria-hidden="true" />
          <span className="sr-only">More actions</span>
        </button>

        {isHistoryOpen && (
          <>
            <button
              type="button"
              className="action-drawer__scrim"
              aria-label={`Close progress history for "${book.title}"`}
              onClick={() => setIsHistoryOpen(false)}
            />
            <section className="action-drawer" role="dialog" aria-modal="true" aria-label={`Progress history for "${book.title}"`}>
              <div className="action-drawer__sheet">
                <div className="action-drawer__handle" aria-hidden="true" />
                <p className="action-drawer__title">Progress History</p>
                <ul className="history-drawer__list" aria-label={`Progress history entries for "${book.title}"`}>
                  {[...book.progressLog].reverse().map((entry, i) => {
                    const dateLabel = formatPtFriendlyDateKey(entry.date) || formatPtFriendlyDate(entry.date) || entry.date;
                    const entryPct = Math.round(Number(entry.currentPercent) || 0);
                    return (
                      <li key={i} className="history-drawer__item">
                        <span className="history-drawer__date">{dateLabel}</span>
                        <span className="history-drawer__percent">{entryPct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </>
        )}

        {isMenuOpen && (
          <>
            <button
              type="button"
              className="action-drawer__scrim"
              aria-label={`Close actions for "${book.title}"`}
              onClick={() => setIsMenuOpen(false)}
            />
            <section className="action-drawer" role="dialog" aria-modal="true" aria-label={`Actions for "${book.title}"`}>
              <div className="action-drawer__sheet">
                <div className="action-drawer__handle" aria-hidden="true" />
                <p className="action-drawer__title">{book.title}</p>
                {onEditPageCount && (
                  <button
                    type="button"
                    className="action-drawer__item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEditPageCount(book.id);
                    }}
                    aria-label={`Edit details for "${book.title}"`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                )}

                {currentPct < 100 && (
                  <button
                    type="button"
                    className="action-drawer__item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onMarkRead(book.id);
                    }}
                    aria-label={`Mark "${book.title}" as finished`}
                  >
                    <Check size={16} aria-hidden="true" />
                    <span>Finished</span>
                  </button>
                )}
                <button
                  type="button"
                  className="action-drawer__item action-drawer__item--danger"
                  onClick={() => {
                    const confirmed = confirmDeleteBook(book.title, { clearProgress: true });
                    if (confirmed) {
                      setIsMenuOpen(false);
                      onDelete(book.id);
                    }
                  }}
                  aria-label={`Delete "${book.title}" from your library`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function CurrentlyReadingList({ books, onLogProgress, onMarkRead, onDelete, onEditPageCount, progressBarStyle }) {
  const currentBooks = books.filter((b) => b.status === 'currently-reading');

  if (currentBooks.length === 0) {
    return (
      <section className="book-section" aria-labelledby="current-heading">
        <h2 id="current-heading">Currently Reading</h2>
        <p className="empty-state">No books in progress. Start reading one from your list!</p>
      </section>
    );
  }

  return (
    <section className="book-section" aria-labelledby="current-heading">
      <h2 id="current-heading">Currently Reading <span className="count">({currentBooks.length})</span></h2>
      <ul className="book-list">
        {currentBooks.map((book) => (
          <li key={book.id}>
            <BookProgressCard
              book={book}
              onLogProgress={onLogProgress}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
              onEditPageCount={onEditPageCount}
              progressBarStyle={progressBarStyle}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
