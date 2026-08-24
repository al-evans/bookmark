// Reports which deployment settings are filled in. The endpoint returns
// booleans only, never values, so this is safe to call before unlocking.
export async function fetchSetupStatus() {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('Could not read setup status.');
  const data = await response.json();
  return data?.setup ?? null;
}
