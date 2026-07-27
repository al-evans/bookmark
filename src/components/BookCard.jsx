import { useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { confirmDeleteBook } from '../utils/deleteConfirmation';

export default function BookCard({ book, onMarkRead, onStartReading, onDelete, onEditPageCount }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const showCoverSkeleton = !book.coverUrl && book.enrichmentStatus === 'pending';

  return (
    <div className="book-card">
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
        {book.aiRecommendation && book.status !== 'read' && (
          <p className="book-recommendation">
            <span className="book-recommendation-icon" aria-hidden="true">✨</span>
            <span>{book.aiRecommendation}</span>
          </p>
        )}
      </div>
      <div className="book-actions book-actions--top">
        <>
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
                  {book.status === 'want-to-read' && onStartReading && (
                    <button
                      type="button"
                      className="action-drawer__item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onStartReading(book.id);
                      }}
                      aria-label={`Start reading "${book.title}"`}
                    >
                      <span aria-hidden="true">▶</span>
                      <span>Start reading</span>
                    </button>
                  )}
                  {book.status === 'want-to-read' && onMarkRead && (
                    <button
                      type="button"
                      className="action-drawer__item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onMarkRead(book.id);
                      }}
                      aria-label={`Mark "${book.title}" as read`}
                    >
                      <span aria-hidden="true">✓</span>
                      <span>Mark read</span>
                    </button>
                  )}
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
                  {book.status === 'want-to-read' && onMarkRead && (
                    null
                  )}
                  <button
                    type="button"
                    className="action-drawer__item action-drawer__item--danger"
                    onClick={() => {
                      const confirmed = confirmDeleteBook(book.title);
                      if (confirmed) {
                        setIsMenuOpen(false);
                        onDelete(book.id);
                      }
                    }}
                    aria-label={`Delete "${book.title}"`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </section>
            </>
          )}
        </>
      </div>
    </div>
  );
}
