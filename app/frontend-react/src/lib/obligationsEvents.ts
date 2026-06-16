/** Сигнал для обновления колокольчика напоминаний после изменения графика. */
export function notifyObligationsUpdated(): void {
  window.dispatchEvent(new CustomEvent('obligations:updated'));
}
