const PREFIX = 'wt_tour_dismissed_v1_';

export function isTourDismissed(tourId: string): boolean {
  return localStorage.getItem(`${PREFIX}${tourId}`) === '1';
}

export function dismissTour(tourId: string): void {
  localStorage.setItem(`${PREFIX}${tourId}`, '1');
}

export function resetTour(tourId: string): void {
  localStorage.removeItem(`${PREFIX}${tourId}`);
}

export function resetAllTours(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
