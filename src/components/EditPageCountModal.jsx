import { useState } from 'react';

export default function EditPageCountModal({ book, onUpdate, onClose }) {
  const [pageCount, setPageCount] = useState(book.totalPages ? String(book.totalPages) : '');
  const [dateStarted, setDateStarted] = useState(book.dateStarted || '');
  const [dateRead, setDateRead] = useState(book.dateRead || '');
  const [error, setError] = useState('');

  const isFinished = book.status === 'read';
  const headingId = 'edit-book-details-title';
  const headingLabel = isFinished ? 'Edit Finished Book' : 'Edit Book Details';

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = Number(pageCount);

    if (!pageCount.trim()) {
      setError('Please enter a page count');
      return;
    }

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Page count must be a positive number');
      return;
    }

    if (isFinished && !dateRead) {
      setError('Please enter an end date');
      return;
    }

    if (dateStarted && dateRead && dateStarted > dateRead) {
      setError('Start date must be on or before end date');
      return;
    }

    onUpdate({
      totalPages: Math.round(parsed),
      dateStarted: dateStarted || null,
      dateRead: dateRead || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="modal">
        <div className="modal-header">
          <h2 id={headingId}>{headingLabel}</h2>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="modal-form-container">
          <div className="form-scroll-content">
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              {book.title}
            </p>
            <label htmlFor="pageCount">Total Pages</label>
            <input
              id="pageCount"
              type="number"
              value={pageCount}
              onChange={(e) => {
                setPageCount(e.target.value);
                setError('');
              }}
              placeholder="e.g. 412"
              autoFocus
              min="1"
            />

            <label htmlFor="dateStarted">Start Date</label>
            <input
              id="dateStarted"
              type="date"
              value={dateStarted}
              onChange={(e) => {
                setDateStarted(e.target.value);
                setError('');
              }}
            />

            {isFinished && (
              <>
                <label htmlFor="dateRead">End Date</label>
                <input
                  id="dateRead"
                  type="date"
                  value={dateRead}
                  onChange={(e) => {
                    setDateRead(e.target.value);
                    setError('');
                  }}
                />
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Update</button>
          </div>
        </form>
      </div>
    </div>
  );
}
