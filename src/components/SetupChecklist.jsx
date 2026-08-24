import { useEffect, useState } from 'react';
import { fetchSetupStatus } from '../services/setup';

const STEPS = [
  {
    key: 'storage',
    title: 'Connect storage',
    where: 'Vercel → Storage → Create Database → Redis',
    detail: 'Pick the free Upstash plan and connect it to this project. Vercel fills in the keys for you.',
  },
  {
    key: 'password',
    title: 'Set a password',
    where: 'Vercel → Settings → Environment Variables → APP_PASSWORD',
    detail: 'This keeps strangers out of your reading list. Any long phrase works.',
  },
];

export default function SetupChecklist({ onRetry }) {
  const [setup, setSetup] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSetupStatus()
      .then((next) => { if (active) setSetup(next); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const handleRetry = async () => {
    setFailed(false);
    try {
      setSetup(await fetchSetupStatus());
    } catch {
      setFailed(true);
    }
    await onRetry();
  };

  return (
    <div className="setup-check">
      <ol className="setup-check__list">
        {STEPS.map((step) => {
          // Until the status arrives, show every step as outstanding rather
          // than guessing, so nothing is marked done that is not done.
          const isDone = setup ? Boolean(setup[step.key]) : false;
          return (
            <li
              key={step.key}
              className={`setup-check__item ${isDone ? 'setup-check__item--done' : ''}`}
            >
              <span className="setup-check__state" aria-hidden="true">{isDone ? '✓' : '•'}</span>
              <div className="setup-check__body">
                <p className="setup-check__title">
                  {step.title}
                  <span className="setup-check__badge">{isDone ? 'Done' : 'To do'}</span>
                </p>
                <p className="setup-check__where">{step.where}</p>
                <p className="setup-check__detail">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {failed && (
        <p className="setup-check__detail">
          The setup check did not answer. Reload after your next deployment finishes.
        </p>
      )}

      <button type="button" className="btn-primary setup-check__retry" onClick={handleRetry}>
        Check again
      </button>
    </div>
  );
}
