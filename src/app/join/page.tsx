import { JoinForm } from "./join-form";

/**
 * Shareable staff invitation acceptance page (D-025).
 *
 * Reached by a link such as `/join#token=<hex>`. The credential lives in the
 * URL fragment, so it never reaches the server in a request line or an access
 * log; the browser posts it to `/api/staff/invitations/*` in the request body.
 *
 * No session is required: possession of the single-use, expiring link is the
 * credential. The page holds no server state of its own, so it renders the
 * client form directly.
 */
export default function JoinPage() {
  return <JoinForm />;
}
