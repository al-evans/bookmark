import { isAiConfigured } from './_lib/aiProvider.js';
import { isAppAuthConfigured } from './_lib/appAuth.js';

// Booleans only. This route is unauthenticated so the app can render a setup
// checklist before anyone can sign in, so it must never return a value —
// only whether each piece has been filled in.
export default function handler(_req, res) {
  const storage = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const password = isAppAuthConfigured();

  return res.status(200).json({
    ok: true,
    setup: {
      storage,
      password,
      ai: isAiConfigured(),
      complete: storage && password,
    },
  });
}
