import type { Metadata } from "next";
import { useEffect, useState } from "react";

export const metadata: Metadata = {
  title: "Platform owner | School Management Platform",
};

function OwnerError({ message }: { message: string }) {
  return (
    <div className="alert alert--error">
      <p>{message}</p>
    </div>
  );
}

// Helper to create a Supabase server client
function createSupabaseClient() {
  return import("@/lib/supabase/server").then((mod) => mod.createSupabaseServerClient());
}

export default function OwnerPage() {
  const [owner, setOwner] = useState(false);
  const [schools, setSchools] = useState<
    | {
        id: string;
        name: string;
        code: string;
        status: string;
        createdAt: string;
      }[]
    | undefined
  >(undefined);
  const [creating, setCreating] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    // Check if the current user is the platform owner
    // by looking for platform_owner app_metadata flag
    const init = async () => {
      const supabase = await createSupabaseClient();
      const { data } = await supabase.auth.getUser();

      if (data.user && data.user.app_metadata) {
        const isOwner = data.user.app_metadata.platform_owner === true;
        setOwner(isOwner);
      }

      // Fetch schools list if owner
      if (owner) {
        const supabase2 = await createSupabaseClient();
        const { data: schoolData, error: schoolError } = await supabase2
          .from("schools")
          .select("id, name, code, status, created_at")
          .order("created_at", { ascending: false });

        if (!schoolError && schoolData) {
          setSchools(
            schoolData.map((s) => ({
              id: s.id as string,
              name: s.name as string,
              code: s.code as string,
              status: (s.status || "unknown") as string,
              createdAt: (s.created_at || "") as string,
            }))
          );
        }
      }
    };

    init();
  }, [owner]);

  if (!owner) {
    return (
      <div className="stack">
        <h1>Platform Owner</h1>
        <p className="muted">
          This page is for the platform owner only. Sign in as the platform owner
          to access school management.
        </p>
        {showSignIn && <OwnerError message="Please sign in as the platform owner." />}
        {!showSignIn && (
          <p className="muted">
            If you are the platform owner, please sign in with your account.
          </p>
        )}
      </div>
    );
  }

  // Owner view - can proceed
  if (creating) {
    return (
      <div className="stack">
        <h1>Creating school…</h1>
        <p className="muted">Please wait while the school is provisioned.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Platform Owner</h1>

      {/* Schools list */}
      {schools !== undefined
        ? schools.length === 0
          ? (
              <p className="muted">
                No schools found. Use the form below to create your first school.
              </p>
            )
          : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>School name</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((school) => (
                      <tr key={school.id}>
                        <td>{school.name}</td>
                        <td>{school.code}</td>
                        <td>{school.status}</td>
                        <td>{school.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        : (
          <p className="muted">
            Loading schools…
          </p>
        )}

      {/* Create school form */}
      <div className="card p-4 mt-4">
        <h2>Create new school</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = (e.target as HTMLFormElement).schoolName.value;
            const code = (e.target as HTMLFormElement).schoolCode.value;
            setCreating(true);
            fetch("/api/admin/create-school", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ schoolName: name, schoolCode: code }),
            })
              .then((res) => res.json())
              .then((data) => {
                setCreating(false);
                if (data.ok) {
                  setShowSignIn(true);
                  // Refresh schools list by re-fetching
                  window.location.reload();
                } else {
                  alert(data.error || "Failed to create school");
                }
              })
              .catch(() => {
                setCreating(false);
                alert("Failed to create school. See logs for details.");
              });
          }}
        >
          <div className="grid gap-3">
            <div>
              <label className="label">School name</label>
              <input
                type="text"
                name="schoolName"
                className="input"
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Christ Academy"
              />
            </div>
            <div>
              <label className="label">School code</label>
              <input
                type="text"
                name="schoolCode"
                className="input"
                required
                pattern="^[A-HJ-NP-RT-Y0-9]{4,10}$"
                placeholder="e.g. CHTS123"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create school"}
          </button>
        </form>
      </div>
    </div>
  );
}