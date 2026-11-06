export type PushSubscriptionRecord = { endpoint: string; person: string; keys: { p256dh: string; auth: string } };

export type PushRepository = {
  list(): PushSubscriptionRecord[];
  save(record: PushSubscriptionRecord): void;
  remove(endpoint: string): void;
};

export type NotifierPort = {
  enabled(): boolean;
  publicKey(): string | null;
  send(message: { title: string; body: string; url: string }): Promise<number>;
};
