import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './i18n.js';

// Re-render the calling component (the app root) when the user switches VIE / ENG.
export function useLanguage() { return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en'); }
