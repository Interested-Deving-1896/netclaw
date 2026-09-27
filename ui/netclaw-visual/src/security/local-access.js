// The HUD can edit local credentials and invoke the operator's agent. It is a
// loopback-only application. Remote access must use an authenticated SSH tunnel.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function hudPorts(env = process.env) {
  const parse = (name, fallback) => {
    const text = env[name] ?? String(fallback);
    if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 65535) {
      throw new Error(`${name} must be a TCP port between 1 and 65535`);
    }
    return Number(text);
  };
  const api = parse('HUD_PORT', 3001);
  const ui = parse('HUD_UI_PORT', 3000);
  if (api === ui) throw new Error('HUD_PORT and HUD_UI_PORT must differ');
  return { api, ui };
}

export function createLocalAccess(ports = hudPorts()) {
  const authorities = new Set([ports.api, ports.ui].flatMap(port =>
    ['127.0.0.1', 'localhost', '[::1]'].map(host => `${host}:${port}`)));
  return req => {
    if (!LOOPBACK.has(req.socket?.remoteAddress)) return false;
    // Ignore proxy-supplied headers: an arbitrary Host must not bypass the
    // loopback boundary through DNS rebinding or a public development proxy.
    if (!authorities.has(req.headers.host)) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    const origin = req.headers.origin;
    if (origin !== undefined) {
      // Exact origin, not a suffix/substring or a permissively parsed URL.
      if (!['http://', 'https://'].some(scheme =>
        typeof origin === 'string' && origin.startsWith(scheme) &&
        authorities.has(origin.slice(scheme.length)))) return false;
    }
    return true;
  };
}

export function localAccessMiddleware(allowed) {
  return (req, res, next) => {
    if (allowed(req)) return next();
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'HUD access requires a trusted local origin. Use an SSH tunnel for remote access.' }));
  };
}
