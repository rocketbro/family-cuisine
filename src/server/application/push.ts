import { isPushEndpoint } from '../../domain/push-endpoint.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Sends a test to every subscribed phone; returns how many got it. */
export function sendTestNotification(deps: Pick<Deps, 'notifier'>): Promise<number> {
  return deps.notifier.send({ title: 'Cuisine', body: 'Notifications are working.', url: '/' });
}

export function subscribeToPush(deps: Deps, subscription: Subscription, person: string): void {
  if (!isPushEndpoint(subscription.endpoint)) throw new UserError('This browser’s push service isn’t one Cuisine knows, so notifications can’t be turned on.');
  deps.subscriptions.save({ endpoint: subscription.endpoint, keys: subscription.keys, person });
}
