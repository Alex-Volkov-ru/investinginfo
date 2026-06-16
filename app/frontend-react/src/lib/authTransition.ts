export function triggerAuthTransition(durationMs = 260): void {
  if (typeof document === 'undefined') return;
  const cls = 'auth-transitioning';
  document.body.classList.add(cls);
  window.setTimeout(() => {
    document.body.classList.remove(cls);
  }, durationMs);
}
