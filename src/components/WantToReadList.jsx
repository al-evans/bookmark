import BookCard from './BookCard';

export default function WantToReadList({ books, onMarkRead, onStartReading, onDelete }) {
  const wantBooks = books.filter((b) => b.status === 'want-to-read');

  if (wantBooks.length === 0) {
    return (
      <section className="book-section" aria-labelledby="want-heading">
        <h2 id="want-heading">Want to Read</h2>
        <p className="empty-state">Your reading list is empty. Add some books!</p>
      </section>
    );
  }

  return (
    <section className="book-section" aria-labelledby="want-heading">
      <h2 id="want-heading">Want to Read <span className="count">({wantBooks.length})</span></h2>
      <ul className="book-list">
        {wantBooks.map((book) => (
          <li key={book.id}>
            <BookCard book={book} onMarkRead={onMarkRead} onStartReading={onStartReading} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}
