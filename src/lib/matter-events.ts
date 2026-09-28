export const MATTERS_REFRESH_EVENT = "matters:refresh";

export function refreshMatters() {
  window.dispatchEvent(new Event(MATTERS_REFRESH_EVENT));
}