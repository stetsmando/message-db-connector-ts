export default class InvalidStreamError extends Error {
  constructor(m?: string) {
    super('InvalidStreamError');

    this.name = 'InvalidStreamError';
    if (m) { this.message = m; }

    // Set the prototype explicitly as per:
    // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, InvalidStreamError.prototype);
  }
}
