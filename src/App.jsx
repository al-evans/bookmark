import { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Bookmark, CheckCircle2, PlusCircle, Settings2 } from 'lucide-react';
import ReadList from './components/ReadList';
import WantToReadList from './components/WantToReadList';
import CurrentlyReadingList from './components/CurrentlyReadingList';
import AddBookForm from './components/AddBookForm';
import EditPageCountModal from './components/EditPageCountModal';
import SetupChecklist from './components/SetupChecklist';
import { enrichBook } from './services/ai';
import { buildAuthHeaders, getStoredAppPassword, readApiError, saveStoredAppPassword } from './services/appAuth';
import { hasReadingReminderSubscription, subscribeToReadingReminders } from './services/pushNotifications';
import { PT_TIME_ZONE_VERSION, getPtDateKey, getTodayPtDateKey, migrateBooksToPtIfNeeded } from './utils/timezone';
import './App.css';

const STORAGE_KEY = 'reading-app-books';
const ADMIN_TEST_TOKEN_KEY = 'reading-app-admin-test-token';
const PROGRESS_BAR_STYLE_KEY = 'reading-app-progress-bar-style';
const THEME_KEY = 'reading-app-theme';
const ICON_SCHEME_KEY = 'reading-app-icon-scheme';
const PROGRESS_BAR_STYLES = [
  { key: 'classic', label: 'Classic rail', description: 'A crisp, familiar progress strip.' },
  { key: 'glow', label: 'Glow sweep', description: 'A vivid gradient with a softer finish.' },
  { key: 'segmented', label: 'Segmented pulse', description: 'A stepped bar that feels more tactile.' },
];
const APPEARANCE_OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Match system' },
];
const FAVICON_VERSION = '20260520-27';
const APPLE_TOUCH_ICON_BASE = '/apple-touch-icon-rg-20260520-8';
const FAVICON_HREF = {
  light: {
    'favicon-32': `/favicon-32.png?v=${FAVICON_VERSION}`,
    'icon-192': `/icon-192.png?v=${FAVICON_VERSION}`,
    'icon-512': `/icon-512.png?v=${FAVICON_VERSION}`,
    'apple-touch-icon': `${APPLE_TOUCH_ICON_BASE}.png`,
    'apple-touch-icon-precomposed': `${APPLE_TOUCH_ICON_BASE}-precomposed.png`,
  },
  dark: {
    'favicon-32': `/favicon-32-dark.png?v=${FAVICON_VERSION}`,
    'icon-192': `/icon-192-dark.png?v=${FAVICON_VERSION}`,
    'icon-512': `/icon-512-dark.png?v=${FAVICON_VERSION}`,
    'apple-touch-icon': `${APPLE_TOUCH_ICON_BASE}-dark.png`,
    'apple-touch-icon-precomposed': `${APPLE_TOUCH_ICON_BASE}-dark-precomposed.png`,
  },
};
const ICON_PREVIEW_SRC = {
  light: '/icon-192.png',
  dark: '/icon-192-dark.png',
};

function triggerHapticFeedback() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(50);
  }
}

function getAdminTestToken() {
  try {
    return localStorage.getItem(ADMIN_TEST_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function getProgressBarStyle() {
  try {
    const stored = localStorage.getItem(PROGRESS_BAR_STYLE_KEY);
    return PROGRESS_BAR_STYLES.some((style) => style.key === stored) ? stored : 'classic';
  } catch {
    return 'classic';
  }
}

function readAppearancePreference(key) {
  try {
    const stored = localStorage.getItem(key);
    return APPEARANCE_OPTIONS.some((opt) => opt.key === stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function getTheme() {
  return readAppearancePreference(THEME_KEY);
}

function getIconScheme() {
  return readAppearancePreference(ICON_SCHEME_KEY);
}

function resolveScheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyFaviconScheme(scheme) {
  if (typeof document === 'undefined') return;
  const variant = FAVICON_HREF[scheme] || FAVICON_HREF.light;
  document.querySelectorAll('link[data-favicon-key]').forEach((link) => {
    const key = link.getAttribute('data-favicon-key');
    if (variant[key]) link.setAttribute('href', variant[key]);
  });
}

function normalizeBooks(source) {
  const parsed = Array.isArray(source) ? source : [];
  return parsed.map((book) => {
    const progressLog = (book.progressLog ?? []).map((entry) => ({
      date: entry.date,
      currentPercent: entry.currentPercent ?? entry.percentage ?? 0,
    }));

    const latest = progressLog.length ? progressLog[progressLog.length - 1] : null;
    const totalPages = Number(book.totalPages);
    return {
      ...book,
      title: typeof book.title === 'string' ? book.title.replace(/\s+/g, ' ').trim() : '',
      author: typeof book.author === 'string' ? book.author.replace(/\s+/g, ' ').trim() : '',
      aiRecommendation: typeof book.aiRecommendation === 'string' ? book.aiRecommendation.replace(/\s+/g, ' ').trim() : '',
      enrichmentStatus: ['pending', 'ready', 'failed'].includes(book.enrichmentStatus) ? book.enrichmentStatus : 'ready',
      dateStarted: typeof book.dateStarted === 'string' && book.dateStarted ? book.dateStarted : null,
      progressLog,
      totalPages: Number.isFinite(totalPages) && totalPages > 0 ? Math.round(totalPages) : null,
      currentPercent: latest ? latest.currentPercent : book.currentPercent ?? 0,
      timeZoneVersion: book?.timeZoneVersion === PT_TIME_ZONE_VERSION ? PT_TIME_ZONE_VERSION : 'legacy-utc',
    };
  });
}

function loadBooks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const normalized = normalizeBooks(parsed);
    return migrateBooksToPtIfNeeded(normalized).books;
  } catch {
    return [];
  }
}

function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    return true;
  } catch {
    return false;
  }
}

function hasTruncatedRecommendation(book) {
  return typeof book?.aiRecommendation === 'string' && /(\.\.\.|…)\s*$/.test(book.aiRecommendation);
}

async function fetchBooksFromApi(appPassword) {
  const response = await fetch('/api/books', { headers: buildAuthHeaders(appPassword) });
  if (!response.ok) {
    throw await readApiError(response, 'Could not load books');
  }
  const data = await response.json();
  return normalizeBooks(data?.books ?? []);
}

async function saveBooksToApi(books, appPassword) {
  const response = await fetch('/api/books', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(appPassword) },
    body: JSON.stringify({ books }),
  });

  if (!response.ok) {
    throw await readApiError(response, 'Could not save books');
  }

  const data = await response.json();
  return normalizeBooks(data?.books ?? []);
}

export default function App() {
  const [books, setBooks] = useState(loadBooks);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('reading');
  const [toastMessage, setToastMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState('loading');
  const [syncMessage, setSyncMessage] = useState('');
  const [hasSyncedInitialData, setHasSyncedInitialData] = useState(false);
  const [pushStatus, setPushStatus] = useState('idle');
  const [isResettingOfflineCache, setIsResettingOfflineCache] = useState(false);
  const [adminTestToken] = useState(getAdminTestToken);
  const [appPassword, setAppPassword] = useState(getStoredAppPassword);
  const [appPasswordInput, setAppPasswordInput] = useState('');
  const [appPasswordError, setAppPasswordError] = useState('');
  const [adminTestStatus, setAdminTestStatus] = useState('');
  const [editingBookId, setEditingBookId] = useState(null);
  const [progressBarStyle, setProgressBarStyle] = useState(getProgressBarStyle);
  const [theme, setTheme] = useState(getTheme);
  const [iconScheme, setIconScheme] = useState(getIconScheme);
  const isAiThinking = books.some((book) => book.enrichmentStatus === 'pending');
  const isSyncingRef = useRef(false);
  const repairingRecommendationIdsRef = useRef(new Set());

  useEffect(() => {
    const saved = saveBooks(books);
    if (!saved) {
      const timeoutId = window.setTimeout(() => {
        setSyncMessage('Could not save to this browser storage right now.');
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [books]);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_BAR_STYLE_KEY, progressBarStyle);
    } catch {
      // Ignore storage failures.
    }
  }, [progressBarStyle]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage failures.
    }
    const apply = () => {
      document.documentElement.setAttribute('data-theme', resolveScheme(theme));
    };
    apply();
    if (theme !== 'auto' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(ICON_SCHEME_KEY, iconScheme);
    } catch {
      // Ignore storage failures.
    }
    const apply = () => applyFaviconScheme(resolveScheme(iconScheme));
    apply();
    if (iconScheme !== 'auto' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [iconScheme]);

  useEffect(() => {
    if (!hasSyncedInitialData || syncStatus !== 'ready') return;

    let cancelled = false;

    async function persistBooks() {
      try {
        await saveBooksToApi(books, appPassword);
      } catch {
        if (!cancelled) {
          setSyncMessage('Saved here, but shared sync failed just now.');
        }
      }
    }

    persistBooks();

    return () => {
      cancelled = true;
    };
  }, [appPassword, books, hasSyncedInitialData, syncStatus]);

  useEffect(() => {
    if (!hasSyncedInitialData || syncStatus !== 'ready') return undefined;

    const staleBooks = books.filter((book) => (
      hasTruncatedRecommendation(book)
      && book.enrichmentStatus !== 'pending'
      && !repairingRecommendationIdsRef.current.has(book.id)
    ));

    if (staleBooks.length === 0) return undefined;

    let cancelled = false;
    staleBooks.forEach((book) => repairingRecommendationIdsRef.current.add(book.id));

    async function repairRecommendations() {
      try {
        await saveBooksToApi(books, appPassword);
      } catch {
        if (!cancelled) {
          setSyncMessage('Saved here, but shared sync failed just now.');
        }
        return;
      }

      for (const book of staleBooks) {
        if (cancelled) return;

        setBooks((prev) => prev.map((entry) => (
          entry.id === book.id ? { ...entry, enrichmentStatus: 'pending' } : entry
        )));

        try {
          const result = await enrichBook({
            bookId: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
          });

          if (cancelled || !result.book) return;

          setBooks((prev) => prev.map((entry) => (
            entry.id === book.id
              ? { ...entry, ...result.book, enrichmentStatus: result.enrichmentStatus === 'failed' ? 'failed' : 'ready' }
              : entry
          )));
        } catch {
          if (!cancelled) {
            setBooks((prev) => prev.map((entry) => (
              entry.id === book.id ? { ...entry, enrichmentStatus: 'failed' } : entry
            )));
          }
        }
      }
    }

    repairRecommendations();

    return () => {
      cancelled = true;
    };
  }, [appPassword, books, hasSyncedInitialData, syncStatus]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = setTimeout(() => setToastMessage(''), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;

    const updateStandaloneState = () => {
      const isStandaloneDisplayMode = media?.matches ?? false;
      const isIosStandalone = typeof window.navigator.standalone === 'boolean' && window.navigator.standalone;
      setIsStandalone(isStandaloneDisplayMode || isIosStandalone);
    };

    updateStandaloneState();
    media?.addEventListener?.('change', updateStandaloneState);

    return () => {
      media?.removeEventListener?.('change', updateStandaloneState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncReminderStatus() {
      const enabled = await hasReadingReminderSubscription();
      if (cancelled) return;
      setPushStatus((current) => (current === 'loading' ? current : enabled ? 'enabled' : 'idle'));
    }

    syncReminderStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = (book) => {
    const enrichmentStartedAt = Date.now();
    const minPendingMs = 900;
    const pendingBook = {
      ...book,
      totalPages: book.totalPages ?? null,
      currentPercent: book.currentPercent ?? 0,
      aiRecommendation: '',
      enrichmentStatus: 'pending',
      timeZoneVersion: PT_TIME_ZONE_VERSION,
    };

    setBooks((prev) => [...prev, pendingBook]);
    triggerHapticFeedback();
    setToastMessage(`Added "${book.title}"`);
    if (book.status === 'read') setActiveTab('read');
    else if (book.status === 'currently-reading') setActiveTab('reading');
    else setActiveTab('want');

    void enrichBook({
      bookId: pendingBook.id,
      title: pendingBook.title,
      author: pendingBook.author,
      isbn: pendingBook.isbn,
    })
      .then((result) => {
        if (!result.book) {
          throw new Error('No enriched book returned.');
        }

        const elapsed = Date.now() - enrichmentStartedAt;
        const waitMs = Math.max(0, minPendingMs - elapsed);

        setTimeout(() => {
          setBooks((prev) => prev.map((entry) => {
            if (entry.id !== pendingBook.id) return entry;
            return {
              ...entry,
              ...result.book,
              enrichmentStatus: result.enrichmentStatus === 'failed' ? 'failed' : 'ready',
            };
          }));
        }, waitMs);
      })
      .catch(() => {
        const elapsed = Date.now() - enrichmentStartedAt;
        const waitMs = Math.max(0, minPendingMs - elapsed);

        setTimeout(() => {
          setBooks((prev) => prev.map((entry) => (
            entry.id === pendingBook.id
              ? { ...entry, enrichmentStatus: 'failed' }
              : entry
          )));
        }, waitMs);
      });
  };

  const handleStartReading = (id) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'currently-reading',
              dateStarted: b.dateStarted || getTodayPtDateKey(),
              progressLog: b.progressLog ?? [],
              currentPercent: b.currentPercent ?? 0,
              aiRecommendation: '',
            }
          : b
      )
    );
    triggerHapticFeedback();
    setActiveTab('reading');
  };

  const handleLogProgress = (id, currentPercent) => {
    const today = getTodayPtDateKey();
    const loggedAt = new Date().toISOString();
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const log = b.progressLog ?? [];
        // Replace entry for today if it exists, otherwise append
        const existing = log.findIndex((e) => getPtDateKey(e.date) === today);
        const newLog =
          existing >= 0
            ? log.map((e, i) => (i === existing ? { date: loggedAt, currentPercent } : e))
            : [...log, { date: loggedAt, currentPercent }];
        return { ...b, progressLog: newLog, currentPercent };
      })
    );
    triggerHapticFeedback();
  };

  const handleMarkRead = (id) => {
    const today = getTodayPtDateKey();
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'read', dateRead: today, currentPercent: 100 } : b))
    );
    triggerHapticFeedback();
    setActiveTab('read');
  };

  const handleDelete = (id) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    triggerHapticFeedback();
  };

  const handleEditPageCount = (id) => {
    setEditingBookId(id);
  };

  const handleUpdatePageCount = ({ totalPages, dateStarted, dateRead }) => {
    if (!editingBookId) return;
    setBooks((prev) =>
      prev.map((b) => (
        b.id === editingBookId
          ? {
              ...b,
              totalPages,
              dateStarted,
              dateRead,
            }
          : b
      ))
    );
    triggerHapticFeedback();
    setToastMessage('Book details updated');
    setEditingBookId(null);
  };

  const handleEnableReminders = async () => {
    setPushStatus('loading');
    try {
      await subscribeToReadingReminders();
      triggerHapticFeedback();
      setPushStatus('enabled');
      setToastMessage('Daily reminders are enabled on this device');
    } catch (error) {
      setPushStatus('error');
      setToastMessage(error?.message || 'Could not enable reminders right now');
    }
  };

  const handleResetOfflineCache = async () => {
    const shouldReset = window.confirm(
      'This will clear offline cached files and reload the app. Continue?'
    );
    if (!shouldReset) return;

    triggerHapticFeedback();
    setIsResettingOfflineCache(true);

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      window.location.reload();
    } catch (error) {
      setToastMessage(error?.message || 'Could not reset offline cache right now');
      setIsResettingOfflineCache(false);
    }
  };

  const handleUnlockSubmit = async (event) => {
    event.preventDefault();
    const nextPassword = appPasswordInput.trim();

    if (!nextPassword) {
      setAppPasswordError('Enter the app password from your Vercel environment.');
      return;
    }

    triggerHapticFeedback();
    setAppPassword(nextPassword);
    saveStoredAppPassword(nextPassword);
    setAppPasswordError('');
    setSyncStatus('loading');
    await syncInitialBooks({ passwordOverride: nextPassword });
  };

  const handleClearAppPassword = () => {
    triggerHapticFeedback();
    setAppPassword('');
    setAppPasswordInput('');
    saveStoredAppPassword('');
    setSyncStatus('locked');
    setSyncMessage('');
    setToastMessage('App password removed from this device');
  };

  const runAdminDryRunChecks = async () => {
    if (!adminTestToken) return;

    triggerHapticFeedback();
    setAdminTestStatus('Running dry-runs...');

    const headers = {
      Authorization: `Bearer ${adminTestToken}`,
    };

    try {
      const reminderResponse = await fetch('/api/admin-cron-test?job=reminder', { headers });

      if (!reminderResponse.ok) {
        throw new Error('Dry-run failed.');
      }

      const reminderData = await reminderResponse.json();

      const reminderWouldNotify = reminderData?.result?.body?.wouldNotify ?? 0;

      const message = `Dry-run OK: reminder subscribers=${reminderWouldNotify}`;
      setAdminTestStatus(message);
      setToastMessage(message);
    } catch (error) {
      const message = error?.message || 'Dry-run failed';
      setAdminTestStatus(message);
      setToastMessage(message);
    }
  };

  const tabs = [
    { key: 'reading', label: 'Currently Reading', icon: BookOpen },
    { key: 'want', label: 'Want to Read', icon: Bookmark },
    { key: 'read', label: 'Finished', icon: CheckCircle2 },
    { key: 'settings', label: 'Settings', icon: Settings2 },
  ];
  const isInitialLoading = syncStatus === 'loading';
  const needsAppPassword = syncStatus === 'locked';
  const needsSetupPassword = syncStatus === 'setup-missing';

  const syncInitialBooks = useCallback(async ({ silent = false, passwordOverride = appPassword } = {}) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    if (!silent) {
      setSyncStatus((current) => (current === 'ready' ? current : 'loading'));
    }

    try {
      const remoteBooks = await fetchBooksFromApi(passwordOverride);
      const localBooks = loadBooks();

      if (remoteBooks.length === 0 && localBooks.length > 0) {
        const migratedLocal = migrateBooksToPtIfNeeded(localBooks).books;
        const importedBooks = await saveBooksToApi(migratedLocal, passwordOverride);
        setBooks(importedBooks);
        setToastMessage('Imported your books for shared sync');
      } else {
        const migratedRemote = migrateBooksToPtIfNeeded(remoteBooks);
        setBooks(migratedRemote.books);
        if (migratedRemote.changed) {
          void saveBooksToApi(migratedRemote.books, passwordOverride).catch(() => {});
        }
      }

      setSyncStatus('ready');
      setSyncMessage('');
    } catch (error) {
      if (error?.code === 'APP_PASSWORD_REQUIRED') {
        saveStoredAppPassword('');
        setAppPassword('');
        setSyncStatus('locked');
        setAppPasswordError(passwordOverride ? 'That password did not work.' : '');
        setSyncMessage('');
      } else if (error?.code === 'APP_PASSWORD_MISSING') {
        setSyncStatus('setup-missing');
        setSyncMessage('');
      } else if (error?.code === 'KV_NOT_CONFIGURED') {
        setSyncStatus('setup-missing');
        setSyncMessage('');
      } else {
        setSyncStatus((current) => (current === 'ready' ? current : 'offline'));
        setSyncMessage('Shared sync is unavailable, so this device is using its own saved books.');
      }
    } finally {
      setHasSyncedInitialData(true);
      isSyncingRef.current = false;
    }
  }, [appPassword]);

  useEffect(() => {
    syncInitialBooks();
  }, [syncInitialBooks]);

  useEffect(() => {
    if (syncStatus === 'ready') return undefined;

    const tryRecover = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncInitialBooks({ silent: true });
    };

    window.addEventListener('online', tryRecover);
    document.addEventListener('visibilitychange', tryRecover);
    const interval = window.setInterval(tryRecover, 30_000);

    return () => {
      window.removeEventListener('online', tryRecover);
      document.removeEventListener('visibilitychange', tryRecover);
      window.clearInterval(interval);
    };
  }, [syncStatus, syncInitialBooks]);

  return (
    <div className={`app ${isStandalone ? 'app--standalone' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <h1>My Reading Goals</h1>
          <button
            className="btn-add btn-add--icon header-add-btn"
            onClick={() => setShowForm(true)}
            aria-label="Add a new book"
            disabled={isAiThinking}
            aria-busy={isAiThinking}
          >
            {isAiThinking ? (
              <span className="btn-add__content" aria-hidden="true">
                <span className="btn-add__spinner" />
              </span>
            ) : (
              <PlusCircle size={32} strokeWidth={1.5} aria-hidden="true" className="add-icon-white" />
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        {isInitialLoading ? (
          <section className="app-loader" aria-label="Loading shared library" aria-busy="true" role="status">
            <span className="app-loader__spinner" aria-hidden="true" />
            <p className="app-loader__label">Loading your library…</p>
          </section>
        ) : (
          <>
            {(needsAppPassword || needsSetupPassword) && (
              <section className="book-section app-lock" aria-labelledby="app-lock-heading">
                <h2 id="app-lock-heading">{needsSetupPassword ? 'Finish setup' : 'Unlock Bookmark'}</h2>
                <p>
                  {needsSetupPassword
                    ? 'This deployment is not ready yet. Finish the steps below, then deploy again.'
                    : 'Enter the app password for this deployment. It is stored only on this device.'}
                </p>
                {needsSetupPassword && (
                  <SetupChecklist onRetry={() => syncInitialBooks()} />
                )}
                {needsAppPassword && (
                  <form className="app-lock__form" onSubmit={handleUnlockSubmit}>
                    <label htmlFor="app-password">App password</label>
                    <input
                      id="app-password"
                      type="password"
                      autoComplete="current-password"
                      value={appPasswordInput}
                      onChange={(event) => setAppPasswordInput(event.target.value)}
                    />
                    {appPasswordError && <p className="app-lock__error">{appPasswordError}</p>}
                    <button className="btn-primary app-lock__button" type="submit">Unlock</button>
                  </form>
                )}
              </section>
            )}

            {syncMessage && !needsAppPassword && (
              <p className="sync-banner sync-banner--warning">
                {syncMessage}
                {syncStatus !== 'ready' && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="sync-banner__retry"
                      onClick={() => syncInitialBooks({ silent: true })}
                    >
                      Retry
                    </button>
                  </>
                )}
              </p>
            )}
            {adminTestStatus && <p className="sync-banner">{adminTestStatus}</p>}

            <div className="tab-content">
              {activeTab === 'reading' && (
                <CurrentlyReadingList
                  books={books}
                  onLogProgress={handleLogProgress}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                  onEditPageCount={handleEditPageCount}
                  progressBarStyle={progressBarStyle}
                />
              )}
              {activeTab === 'want' && (
                <WantToReadList
                  books={books}
                  onMarkRead={handleMarkRead}
                  onStartReading={handleStartReading}
                  onDelete={handleDelete}
                />
              )}
              {activeTab === 'read' && (
                <ReadList books={books} onDelete={handleDelete} onEditPageCount={handleEditPageCount} />
              )}
              {activeTab === 'settings' && (
                <section className="book-section settings-panel" aria-labelledby="settings-heading">
                  <h2 id="settings-heading">Settings</h2>
                  <p className="settings-copy">Manage reminders, offline cache, and diagnostics.</p>
                  <div className="settings-group" aria-labelledby="progress-style-heading">
                    <div className="settings-group__header">
                      <h3 id="progress-style-heading">Progress bar style</h3>
                      <p>Pick the card progress look you want to live with.</p>
                    </div>
                    <div className="progress-style-picker" aria-label="Progress bar style">
                      {PROGRESS_BAR_STYLES.map((style) => {
                        const isSelected = progressBarStyle === style.key;
                        return (
                          <button
                            key={style.key}
                            type="button"
                            className={`progress-style-card ${isSelected ? 'progress-style-card--selected' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => setProgressBarStyle(style.key)}
                          >
                            <span className="progress-style-card__label">{style.label}</span>
                            <span className="progress-style-card__preview progress-style-card__preview--settings" aria-hidden="true">
                              <span className={`progress-bar-track progress-bar-track--${style.key}`}>
                                <span className={`progress-bar-fill progress-bar-fill--${style.key}`} style={{ width: '68%' }} />
                              </span>
                            </span>
                            <span className="progress-style-card__description">{style.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-group" aria-labelledby="appearance-heading">
                    <div className="settings-group__header">
                      <h3 id="appearance-heading">Appearance</h3>
                      <p>Switch the app between light and dark, or follow your device.</p>
                    </div>
                    <div className="settings-segmented" role="radiogroup" aria-label="App theme">
                      {APPEARANCE_OPTIONS.map((option) => {
                        const isSelected = theme === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={`settings-segmented__item ${isSelected ? 'settings-segmented__item--active' : ''}`}
                            onClick={() => setTheme(option.key)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-group" aria-labelledby="app-icon-heading">
                    <div className="settings-group__header">
                      <h3 id="app-icon-heading">App icon</h3>
                      <p>
                        Picks the favicon shown in browser tabs and the icon iOS will install the next time you Add to Home Screen.
                        An icon already on your home screen stays put — remove and re-add to swap it.
                      </p>
                    </div>
                    <div className="icon-scheme-preview" aria-hidden="true">
                      <img
                        src={ICON_PREVIEW_SRC[resolveScheme(iconScheme)]}
                        alt=""
                        width="64"
                        height="64"
                        className="icon-scheme-preview__img"
                      />
                    </div>
                    <div className="settings-segmented" role="radiogroup" aria-label="App icon scheme">
                      {APPEARANCE_OPTIONS.map((option) => {
                        const isSelected = iconScheme === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={`settings-segmented__item ${isSelected ? 'settings-segmented__item--active' : ''}`}
                            onClick={() => setIconScheme(option.key)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="settings-group" aria-labelledby="app-password-heading">
                    <div className="settings-group__header">
                      <h3 id="app-password-heading">App password</h3>
                      <p>Remove the saved password from this device before handing it to someone else.</p>
                    </div>
                    <button
                      className="btn-secondary settings-panel-btn"
                      type="button"
                      onClick={handleClearAppPassword}
                      aria-label="Forget app password on this device"
                    >
                      Forget App Password
                    </button>
                  </div>
                  <button
                    className="btn-secondary settings-panel-btn"
                    onClick={handleEnableReminders}
                    disabled={pushStatus === 'loading' || pushStatus === 'enabled'}
                    aria-label="Enable reading reminders"
                  >
                    {pushStatus === 'loading' ? 'Enabling Reminders...' : pushStatus === 'enabled' ? 'Reminders Enabled' : 'Enable Reminders'}
                  </button>
                  <button
                    className="btn-secondary settings-panel-btn"
                    onClick={handleResetOfflineCache}
                    disabled={isResettingOfflineCache}
                    aria-label="Reset offline cache"
                  >
                    {isResettingOfflineCache ? 'Resetting Cache...' : 'Reset Offline Cache'}
                  </button>
                  {adminTestToken && (
                    <button
                      className="btn-secondary settings-panel-btn"
                      onClick={runAdminDryRunChecks}
                      aria-label="Run admin dry-run checks"
                    >
                      Run Dry-Run Checks
                    </button>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </main>

      <nav className="bottom-nav" role="tablist" aria-label="Primary navigation">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`bottom-nav__item ${activeTab === tab.key ? 'bottom-nav__item--active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                triggerHapticFeedback();
              }}
              aria-label={tab.label}
            >
              <IconComponent size={18} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {showForm && (
        <AddBookForm onAdd={handleAdd} onClose={() => setShowForm(false)} />
      )}

      {editingBookId && (
        <EditPageCountModal
          book={books.find((b) => b.id === editingBookId)}
          onUpdate={handleUpdatePageCount}
          onClose={() => setEditingBookId(null)}
        />
      )}

      {toastMessage && (
        <p className="toast" role="status" aria-live="polite">{toastMessage}</p>
      )}
    </div>
  );
}
