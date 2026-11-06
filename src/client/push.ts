// Turning on notifications for this phone. iOS only allows it from the home-screen app,
// over HTTPS, and only in response to a tap.
import { api } from './api.ts';

export function pushSupport(): 'ok' | 'install' | 'unsupported' {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    return /iPhone|iPad/.test(navigator.userAgent) && !standalone ? 'install' : 'unsupported';
  }
  return 'ok';
}

export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

export async function enablePush(person: string, publicKey: string): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications were not allowed.');
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) }));
  await api.subscribe(person, subscription.toJSON());
}

export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(await registration?.pushManager.getSubscription());
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
