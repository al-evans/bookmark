import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CurrentlyReadingList from '../components/CurrentlyReadingList';

function createBook(id, title, logCount) {
  return {
    id,
    title,
    status: 'currently-reading',
    progressLog: Array.from({ length: logCount }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      currentPercent: (index + 1) * 10,
    })),
    currentPercent: logCount * 10,
  };
}

function renderList(books) {
  return render(
    <CurrentlyReadingList
      books={books}
      onLogProgress={vi.fn()}
      onSetProgressUnit={vi.fn()}
      onMarkRead={vi.fn()}
      onDelete={vi.fn()}
      onEditPageCount={vi.fn()}
    />,
  );
}

describe('CurrentlyReadingList progress history', () => {
  it('keeps the history drawer outside the book action stacking layer', () => {
    renderList([
      createBook('first', 'First book', 7),
      createBook('second', 'Second book', 1),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View progress history for "First book"' }));

    const dialog = screen.getByRole('dialog', { name: 'Progress history for "First book"' });
    expect(dialog.closest('.book-actions--top')).toBeNull();
    expect(screen.getByRole('button', { name: 'More actions for "Second book"' })).toBeInTheDocument();
  });

  it('shows the five newest entries first and allows readers to expand the history', () => {
    renderList([createBook('first', 'First book', 7)]);
    fireEvent.click(screen.getByRole('button', { name: 'View progress history for "First book"' }));

    const dialog = screen.getByRole('dialog', { name: 'Progress history for "First book"' });
    const collapsedEntries = within(dialog).getAllByRole('listitem');
    expect(collapsedEntries).toHaveLength(5);
    expect(collapsedEntries[0]).toHaveTextContent('70%');
    expect(collapsedEntries[4]).toHaveTextContent('30%');

    fireEvent.click(within(dialog).getByRole('button', { name: 'View all 7 entries' }));
    const expandedEntries = within(dialog).getAllByRole('listitem');
    expect(expandedEntries).toHaveLength(7);
    expect(expandedEntries[6]).toHaveTextContent('10%');
    expect(within(dialog).getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Show less' }));
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
  });

  it('chooses the five newest entries by date when history is out of order', () => {
    const book = createBook('first', 'First book', 7);
    book.progressLog = [
      { date: '2026-09-01', currentPercent: 10 },
      { date: '2026-09-07', currentPercent: 70 },
      { date: '2026-09-02', currentPercent: 20 },
      { date: '2026-09-06', currentPercent: 60 },
      { date: '2026-09-03', currentPercent: 30 },
      { date: '2026-09-05', currentPercent: 50 },
      { date: '2026-09-04', currentPercent: 40 },
    ];
    renderList([book]);
    fireEvent.click(screen.getByRole('button', { name: 'View progress history for "First book"' }));

    const dialog = screen.getByRole('dialog', { name: 'Progress history for "First book"' });
    const entries = within(dialog).getAllByRole('listitem');
    expect(entries).toHaveLength(5);
    expect(entries.map((entry) => entry.textContent)).toEqual([
      expect.stringContaining('70%'),
      expect.stringContaining('60%'),
      expect.stringContaining('50%'),
      expect.stringContaining('40%'),
      expect.stringContaining('30%'),
    ]);
  });

  it('shows the full history without a view-all control when it has five or fewer entries', () => {
    renderList([createBook('first', 'First book', 5)]);
    fireEvent.click(screen.getByRole('button', { name: 'View progress history for "First book"' }));

    const dialog = screen.getByRole('dialog', { name: 'Progress history for "First book"' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
    expect(within(dialog).queryByRole('button', { name: /View all/i })).not.toBeInTheDocument();
  });
});
