"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";

/**
 * School sign-up form (presentational only).
 *
 * The fields are shown so the page matches the other auth pages, but the form
 * is deliberately non-functional: there is no server-enforced, school-scoped
 * creation path yet, so nothing is submitted. When that path is approved and
 * built, this form is wired to it.
 */
export function SignupForm() {
  return (
    <form
      className="stack stack--sm"
      onSubmit={(event) => event.preventDefault()}
      noValidate
    >
      <Alert variant="info" role={null}>
        School self-service sign-up is not available yet. To get your school set
        up, request a demo from the home page.
      </Alert>

      <TextField
        label="School name"
        name="schoolName"
        placeholder="e.g. ABC Academy"
        disabled
      />

      <TextField
        label="School code"
        name="schoolCode"
        hint="Optional. Used to identify your school; it can be generated later."
        placeholder="e.g. ABC-001"
        disabled
      />

      <div>
        <Button type="submit" disabled>
          Create school account
        </Button>
      </div>
    </form>
  );
}
