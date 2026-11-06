// A problem the person using the app can read and act on. Its message reaches them as written;
// any other error is logged and answered with a generic message, since it can hold paths or
// other internals. Status is a plain number so use cases stay free of the web framework.
import type { ProblemCode } from '../../shared/views.ts';

export class UserError extends Error {
  readonly status: number;
  readonly code: ProblemCode | null;

  constructor(message: string, status = 400, code: ProblemCode | null = null) {
    super(message);
    this.name = 'UserError';
    this.status = status;
    this.code = code;
  }
}
