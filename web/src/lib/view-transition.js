import { flushSync } from 'react-dom';

export function runViewTransition(update) {
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof document === 'undefined' || !document.startViewTransition || reducedMotion) return update();
  return document.startViewTransition(() => flushSync(update));
}
