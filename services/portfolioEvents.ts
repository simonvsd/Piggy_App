export type Listener = () => void;
let listeners: Listener[] = [];

export function notifyPortfolioChanged() {
  listeners.forEach((l) => l());
}

export function subscribePortfolioChanged(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
