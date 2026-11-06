// Notifications to every subscribed phone. iOS delivers web push only to
// home-screen web apps opened over HTTPS, which is what the tailnet address provides.
import webpush from 'web-push';
import { isPushEndpoint } from '../../../domain/push-endpoint.ts';
import type { NotifierPort, PushRepository } from '../../application/ports/notifications.ts';

type Options = {
  publicKey: string | null;
  privateKey: string | null;
  subject: string | null;
  subscriptions: PushRepository;
  log: (message: string) => void;
  deliver?: typeof webpush.sendNotification;
};

/** Bad push settings turn notifications off with a reason; they never stop the app starting. */
function vapidReady(opts: Options): boolean {
  if (!opts.publicKey || !opts.privateKey) return false;
  if (!opts.subject) {
    opts.log('Push is off: VAPID keys are set, but web push needs a contact. Set VAPID_SUBJECT to a mailto: or https: address, or use an https PUBLIC_URL.');
    return false;
  }
  try {
    webpush.setVapidDetails(opts.subject, opts.publicKey, opts.privateKey);
    return true;
  } catch {
    // Not the library's message: it can quote the keys' shape back, and these go to a log.
    opts.log('Push is off: the VAPID keys or subject were refused. Check VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.');
    return false;
  }
}

export function webPushNotifier(opts: Options): NotifierPort {
  const ready = vapidReady(opts);
  const deliver = opts.deliver ?? webpush.sendNotification.bind(webpush);
  return {
    enabled: () => ready,
    publicKey: () => (ready ? opts.publicKey : null),
    async send(message) {
      if (!ready) return 0;
      let delivered = 0;
      for (const sub of opts.subscriptions.list()) {
        // Subscriptions saved before the allowlist existed get the same check.
        if (!isPushEndpoint(sub.endpoint)) {
          opts.log(`push to ${sub.person} skipped: its endpoint isn't a known push service`);
          continue;
        }
        try {
          await deliver({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(message), { TTL: 6 * 3600 });
          delivered += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: the phone dropped this subscription; forget it.
          if (status === 404 || status === 410) opts.subscriptions.remove(sub.endpoint);
          else console.error(`push to ${sub.person} failed:`, (error as Error).message);
        }
      }
      return delivered;
    },
  };
}
