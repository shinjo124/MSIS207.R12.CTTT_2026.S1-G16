// Build responsive URLs only for ordinary versioned Cloudinary uploads. Otherwise the caller keeps the original URL.
export function feedImageSources(original) {
  if (typeof original !== 'string') return null;
  let url;
  try { url = new URL(original); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.port || url.username || url.password || url.search || url.hash) return null;
  const match = url.pathname.match(/^\/([^/]+)\/image\/upload\/(v\d+\/.+)$/);
  if (!match || !/^[a-z0-9_-]+$/i.test(match[1]) || /[,\s]/.test(url.pathname)) return null;
  const makeUrl = (width) => `${url.origin}/${match[1]}/image/upload/c_scale,w_${width}/q_auto/f_auto/${match[2]}`;
  return {
    src: makeUrl(768),
    srcSet: [480, 768, 1200, 1600].map((width) => `${makeUrl(width)} ${width}w`).join(', '),
    sizes: '(max-width: 640px) calc(100vw - 64px), 676px',
  };
}
