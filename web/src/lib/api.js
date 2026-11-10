export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? 'https://tripo-api-eta.vercel.app' : 'http://localhost:4000')).replace(/\/+$/, '');

export async function apiRequest(path, options = {}) {
  const { getToken, headers: inputHeaders, body: inputBody, ...requestOptions } = options;
  const headers = new Headers(inputHeaders);
  let body = inputBody;

  if (body != null && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  if (getToken) {
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(new URL(`/api${path}`, apiBaseUrl), { ...requestOptions, headers, body });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || 'The request could not be completed.');
  return result;
}
