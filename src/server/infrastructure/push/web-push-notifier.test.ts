import { describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { webPushNotifier } from './web-push-notifier.ts';

const keys = webpush.generateVAPIDKeys();
const APPLE = 'https://web.push.apple.com/abc';
const sub = (endpoint: string) => ({ endpoint, person: 'Sam', keys: { p256dh: 'p', auth: 'a' } });
const subscriptions = (list = [sub(APPLE)]) => ({ list: () => list, save: () => undefined, remove: () => undefined });

function notifier(subject: string | null, publicKey: string | null = keys.publicKey, privateKey: string | null = keys.privateKey) {
  const logged: string[] = [];
  const made = webPushNotifier({ publicKey, privateKey, subject, subscriptions: subscriptions(), log: line => void logged.push(line) });
  return { made, logged };
}

describe('starting up', () => {
  it('turns on with keys and a subject, as a tailnet install has', () => {
    const { made, logged } = notifier('https://kitchen.tail1234.ts.net:8490');
    expect(made.enabled()).toBe(true);
    expect(made.publicKey()).toBe(keys.publicKey);
    expect(logged).toEqual([]);
  });

  it('turns off with a clear line, rather than crashing, when no subject is usable', () => {
    const { made, logged } = notifier(null);
    expect(made.enabled()).toBe(false);
    expect(made.publicKey()).toBeNull();
    expect(logged[0]).toContain('VAPID_SUBJECT');
  });

  it('turns off with a clear line on keys the library refuses, without quoting them', () => {
    const { made, logged } = notifier('mailto:me@example.com', 'not-a-key', 'also-not-a-key');
    expect(made.enabled()).toBe(false);
    expect(logged[0]).toContain('Push is off');
    expect(logged[0]).not.toContain('not-a-key');
  });

  it('stays quietly off with no keys at all', () => {
    const { made, logged } = notifier('mailto:me@example.com', null, null);
    expect(made.enabled()).toBe(false);
    expect(logged).toEqual([]);
  });

  it('would crash on an http subject without this guard', () => {
    expect(() => webpush.setVapidDetails('http://127.0.0.1:2847', keys.publicKey, keys.privateKey)).toThrow();
  });
});

describe('sending', () => {
  it('posts only to real push services, even for subscriptions saved earlier', async () => {
    const logged: string[] = [];
    const posted: string[] = [];
    const made = webPushNotifier({
      publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:me@example.com',
      subscriptions: subscriptions([sub(APPLE), sub('http://169.254.169.254/latest'), sub('https://evil.example/push')]),
      log: line => void logged.push(line),
      deliver: async to => {
        posted.push(to.endpoint);
        return { statusCode: 201, body: '', headers: {} };
      },
    });
    expect(await made.send({ title: 't', body: 'b', url: '/' })).toBe(1);
    expect(posted).toEqual([APPLE]);
    expect(logged).toHaveLength(2);
  });
});
