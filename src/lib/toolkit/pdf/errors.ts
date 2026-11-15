/** A problem the person can act on (wrong file, unreadable PDF...), shown as-is in the UI. */
export class DocError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocError';
  }
}
