const RETURN_URL_KEY = 'auth_return_url';

export function saveReturnUrl(path: string): void {
  if (!path || path === '/login') return;
  sessionStorage.setItem(RETURN_URL_KEY, path);
}

export function consumeReturnUrl(fallback: string): string {
  const stored = sessionStorage.getItem(RETURN_URL_KEY);
  sessionStorage.removeItem(RETURN_URL_KEY);
  if (stored && stored !== '/login') return stored;
  return fallback;
}
