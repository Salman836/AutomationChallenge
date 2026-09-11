/**
 * Secret redaction (Risk R-05).
 *
 * `env.js` registers the key and token the first time it reads them, and everything
 * the logger prints passes through `redact` on the way out.
 
 */

/** @type {Set<string>} */
const secrets = new Set();

export function registerSecret(value) {
  if (typeof value === 'string' && value.length >= 8) {
    secrets.add(value);
  }
}

export function redact(input) {
  if (input == null) return input;
  let text = typeof input === 'string' ? input : String(input);
  for (const secret of secrets) {
    if (!secret) continue;
    text = text.split(secret).join(`***redacted(${secret.length})***`);
  }
  return text;
}
