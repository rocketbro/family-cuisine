// The server posts to whatever endpoint a phone subscribes with, so only the browsers' real push
// services are accepted: Apple, Google (Chrome, Android, most others) Mozilla and Microsoft.
const PUSH_SERVICES = ['push.apple.com', 'fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return PUSH_SERVICES.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
}
