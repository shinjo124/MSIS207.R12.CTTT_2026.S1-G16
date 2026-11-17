export const INVITATION_STORAGE_KEY = 'tripo.invitation';
export const INVITATION_RETURN_KEY = 'tripo.invitation.return';
export function invitationFromFragment(fragment) {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token');
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
export function invitationUrl(origin, token) {
  const url = new URL('/invite', origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}
