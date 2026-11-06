// A name for one put-away, so the server can tell a retry from buying more. `randomUUID` only exists
// on HTTPS and localhost, and checking things off has to work on a plain network address too.
export function newPutAwayToken(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
