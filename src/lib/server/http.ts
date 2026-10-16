import "server-only";

import { NextResponse } from "next/server";

/**
 * JSON response for the staff API routes. Every response is `no-store`: these
 * endpoints return school-scoped data behind a session cookie and must never be
 * cached by a shared proxy.
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
