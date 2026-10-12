// Cookie helpers shared by the session-refresh live checks (06, 07).
//
// @supabase/ssr stores the session in `sb-<ref>-auth-token` cookies, possibly
// split into `.0`, `.1`, ... chunks and/or base64-prefixed. The combined value
// is the JSON session object auth-js writes to storage.
export function accessTokenExpFromCookieValue(value) {
  let v = value;
  if (v.startsWith("base64-")) {
    v = Buffer.from(v.slice("base64-".length), "base64url").toString("utf8");
  }
  let token;
  try {
    token = JSON.parse(v).access_token;
  } catch {
    token = v; // older layout: the raw JWT is the cookie value
  }
  if (!token) throw new Error("no access token found in auth cookie");
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  );
  if (!Number.isFinite(payload.exp)) throw new Error("access token has no exp");
  return payload.exp;
}

/** Combines chunked `sb-...-auth-token` Set-Cookie values into a cookie map. */
export function cookieMapFromSetCookie(setCookieHeaders) {
  const byBase = new Map();
  for (const header of setCookieHeaders) {
    const name = header.slice(0, header.indexOf("="));
    const value = header.slice(header.indexOf("=") + 1, header.indexOf(";"));
    const m = /^(.*)\.(\d+)$/.exec(name);
    if (m) {
      const baseName = m[1];
      const idx = Number(m[2]);
      const list = byBase.get(baseName) ?? [];
      list[idx] = value;
      byBase.set(baseName, list);
    } else {
      byBase.set(name, [value]);
    }
  }
  const out = {};
  for (const [name, parts] of byBase) {
    if (!name.includes("auth-token")) continue;
    out[name] = parts.join("");
  }
  return out;
}

export function cookieHeader(map) {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
