// A refusal from the server: its message for the person, and a code when the screen can do more.
import type { ProblemCode } from '../shared/views.ts';

export class ApiError extends Error {
  readonly code: ProblemCode | null;

  constructor(message: string, code: ProblemCode | null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}
