import { flushSync } from 'react-dom';

// A browser without the transition API still runs the update. Supported browsers capture it around a React flush.
export function runViewTransition(update) {
  if (typeof document === 'undefined' || !document.startViewTransition) return update();
  return document.startViewTransition(() => flushSync(update));
}
