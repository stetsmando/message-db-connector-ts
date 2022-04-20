export default class InvalidTimeError extends Error {
  constructor(m?: string) {
    super('InvalidTimeError');

    this.name = 'InvalidTimeError';
    if (m) { this.message = m; }

    // Set the prototype explicitly as per:
    // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, InvalidTimeError.prototype);
  }
}
