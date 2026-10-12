// Management API helper for the session-refresh live checks (06, 07).
//
// The token and project ref come from the environment at runtime — they are
// never committed or printed. Retries with backoff absorb the intermittent
// network flakiness seen against api.supabase.com, and an AbortController
// timeout stops a hanging request from stalling the whole suite.
export async function mgmtFetch(path, method, body) {
  const token = process.env.SUPABASE_MGMT_TOKEN;
  const ref = process.env.SUPABASE_MGMT_PROJECT_REF;
  if (!token || !ref) {
    throw new Error(
      "SUPABASE_MGMT_TOKEN and SUPABASE_MGMT_PROJECT_REF must be set in the environment",
    );
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${ref}${path}`,
        {
          method,
          headers,
          signal: controller.signal,
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`,
        );
      }
      return res.status === 204 ? null : await res.json();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 4000));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
