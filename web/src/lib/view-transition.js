import { flushSync } from 'react-dom';

export function runViewTransition(update) {
  if (typeof document === 'undefined' || !document.startViewTransition) return update();
  return document.startViewTransition(() => flushSync(update));
}
