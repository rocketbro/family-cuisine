import { describe, expect, it } from 'vitest';
import { isPushEndpoint } from './push-endpoint.ts';

describe('isPushEndpoint', () => {
  it.each(['https://web.push.apple.com/abc', 'https://fcm.googleapis.com/fcm/send/abc', 'https://android.googleapis.com/gcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc'])('takes %s', endpoint => {
    expect(isPushEndpoint(endpoint)).toBe(true);
  });

  it.each(['http://web.push.apple.com/abc', 'https://evil.example/push', 'https://web.push.apple.com.evil.example/', 'https://evilpush.apple.com/', 'https://notfcm.googleapis.com/', 'https://user:pw@fcm.googleapis.com/', 'https://fcm.googleapis.com:8443/', 'http://127.0.0.1:2847/api', 'http://169.254.169.254/latest', 'nonsense'])('refuses %s', endpoint => {
    expect(isPushEndpoint(endpoint)).toBe(false);
  });
});
