/**
 * Comma-separated list of allowed origins in production (CORS_ORIGINS=https://a.app,https://b.app).
 * When unset, any origin is allowed — convenient for local dev and for phones on the LAN.
 */
export function corsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS?.trim();
  return raw ? raw.split(',').map((origin) => origin.trim()) : true;
}
