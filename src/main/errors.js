export class LauncherError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'LauncherError';
    this.code = code;
  }
}

export function assertValue(condition, code, message) {
  if (!condition) throw new LauncherError(code, message);
}
