// Where the app keeps its browser-side data.
//
// The product was called Reading Goals before it became Bookmark. These are
// the names it saves under now. Keep them here rather than in App.jsx, so the
// migration below can be tested on its own.
export const STORAGE_KEY = 'bookmark-books';
export const ADMIN_TEST_TOKEN_KEY = 'bookmark-admin-test-token';
export const PROGRESS_BAR_STYLE_KEY = 'bookmark-progress-bar-style';
export const THEME_KEY = 'bookmark-theme';
export const ICON_SCHEME_KEY = 'bookmark-icon-scheme';

// An install made before the rename still holds its data under the old names.
// Move each value across once, then delete the old copy. Without this step the
// first load of the renamed app looks like a factory reset: no books, the
// default theme and the default icon.
const RENAMED_STORAGE_KEYS = [
  ['reading-app-books', STORAGE_KEY],
  ['reading-app-admin-test-token', ADMIN_TEST_TOKEN_KEY],
  ['reading-app-progress-bar-style', PROGRESS_BAR_STYLE_KEY],
  ['reading-app-theme', THEME_KEY],
  ['reading-app-icon-scheme', ICON_SCHEME_KEY],
];

// An empty list is what a first load writes before any old data is read. Treat
// that as "nothing here" on both sides, so it cannot block the migration and
// strand the books under the old name.
function isEmptyStoredValue(value) {
  return value === null || value === '' || value === '[]';
}

export function migrateRenamedStorageKeys() {
  for (const [oldKey, newKey] of RENAMED_STORAGE_KEYS) {
    try {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue === null) continue;

      if (isEmptyStoredValue(oldValue)) {
        localStorage.removeItem(oldKey);
        continue;
      }

      if (!isEmptyStoredValue(localStorage.getItem(newKey))) {
        // Real data is already saved under the new name, so it wins. Leave the
        // old copy alone: never delete a value that has not been moved.
        continue;
      }

      localStorage.setItem(newKey, oldValue);
      // Safe to drop now, because the new copy is written.
      localStorage.removeItem(oldKey);
    } catch {
      // Storage can be full or blocked. Leave the old copy and try again later.
    }
  }
}
