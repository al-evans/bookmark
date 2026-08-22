export const APP_PASSWORD_STORAGE_KEY = 'bookmark-app-password';

export function getStoredAppPassword() {
  try {
    return localStorage.getItem(APP_PASSWORD_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredAppPassword(password) {
  try {
    if (password) {
      localStorage.setItem(APP_PASSWORD_STORAGE_KEY, password);
    } else {
      localStorage.removeItem(APP_PASSWORD_STORAGE_KEY);
    }
  } catch {
    // Storage failures should not block the current in-memory unlock.
  }
}

export function buildAuthHeaders(password = getStoredAppPassword()) {
  const trimmed = String(password || '').trim();
  return trimmed ? { Authorization: `Bearer ${trimmed}` } : {};
}

export async function readApiError(response, fallback) {
  const data = await response.json().catch(() => null);
  const error = new Error(data?.error || fallback);
  error.status = response.status;
  error.code = data?.code || '';
  return error;
}
