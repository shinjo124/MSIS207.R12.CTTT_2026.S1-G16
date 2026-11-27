// Two-language UI (English / Vietnamese). English text is the key; vi.js maps it to Vietnamese.
// The choice is kept in localStorage; the first visit follows the browser language.
import vi from './i18n-vi.js';

export const LANGUAGES = [{ code: 'vi', label: 'VIE' }, { code: 'en', label: 'ENG' }];
const STORAGE_KEY = 'tripo-language';
const listeners = new Set();

function initialLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  const browser = globalThis.navigator?.languages?.[0] || globalThis.navigator?.language || 'en';
  return browser.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

let language = initialLanguage();
if (globalThis.document) document.documentElement.lang = language;

export function getLanguage() { return language; }

export function setLanguage(next) {
  if (next !== 'vi' && next !== 'en') return;
  if (next === language) return;
  language = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* not saved, still switches */ }
  if (globalThis.document) document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener) { listeners.add(listener); return () => listeners.delete(listener); }

// t('Hello {name}', { name }) → translated text with values filled in.
export function t(text, values) {
  let out = language === 'vi' && Object.hasOwn(vi, text) ? vi[text] : text;
  if (values) out = out.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(values, key) ? String(values[key]) : match));
  return out;
}

// Locale for Intl date and number formatting.
export function locale() { return language === 'vi' ? 'vi-VN' : 'en-GB'; }
