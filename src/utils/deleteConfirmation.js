export function confirmDeleteBook(title, options = {}) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  const baseMessage = `Are you sure you want to delete "${title}"?`;
  const detail = options.clearProgress ? ' This will also clear its reading progress.' : '';

  return window.confirm(`${baseMessage}${detail}`);
}