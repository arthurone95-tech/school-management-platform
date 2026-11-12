import "use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { Loader2, CheckCircle } from "lucide-react";

interface RegisterState {
  schoolName: string;
  schoolCode: string;
  adminEmail: string;
  adminPassword: string;
  submitting: boolean;
  success: boolean | null;
  error: string | null;
}

const initialState: RegisterState = {
  schoolName: "",
  schoolCode: "",
  adminEmail: "",
  adminPassword: "",
  submitting: false,
  success: null,
  error: null,
};

function SchoolRegisterPage() {
  const [state, setState] = useState<RegisterState>(initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success === true) {
      const saved = localStorage.getItem("redirect-after-register");
      router.push(saved || "/dashboard/school");
    }
  }, [state.success, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const response = await fetch("/api/school/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: state.schoolName,
          schoolCode: state.schoolCode,
          adminEmail: state.adminEmail,
          adminPassword: state.adminPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setState((prev) => ({
          ...prev,
          submitting: false,
          error: data.error || "Registration failed. Please try again.",
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
      }));

      if (data.instructions?.signInUrl) {
        localStorage.setItem("redirect-after-register", data.instructions.signInUrl);
      }

      router.push("/sign-in");
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error:
          "Could not connect to server. Please check your connection and try again.",
      }));
    }
  };

  if (state.success === true) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-background p-8 rounded-lg shadow-xl text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-primary-600" />
          <h2 className="mt-4 text-2xl font-bold text-foreground">
            School Registered Successfully!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your school has been created. You can now sign in to the admin dashboard.
          </p>
          <Button onClick={() => router.push("/sign-in")} className="mt-6">
            Go to Sign-In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            Register Your School
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your school account to get started
          </p>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-4">
        <Card>
          <CardHeader title="Create School Account" description="Join the School Management Platform" />
          <CardBody>
            <p className="text-sm text-muted-foreground mb-4">
              Join the School Management Platform and start managing your school account
              academics, grading, and student records.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label="School Name"
                name="schoolName"
                value={state.schoolName}
                onChange={handleChange}
                placeholder="e.g., Ghana Community School"
                required
              />

              <TextField
                label="School Code"
                name="schoolCode"
                type="text"
                value={state.schoolCode}
                onChange={handleChange}
                placeholder="e.g., ABC1234"
                pattern="[A-HJ-NP-RT-Y0-9]{4,10}"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                4-10 characters, consonants and digits only (no vowels A, E, I, O, U)
              </p>

              <TextField
                label="Admin Email"
                name="adminEmail"
                type="email"
                value={state.adminEmail}
                onChange={handleChange}
                placeholder="admin@schoolname.com"
                required
              />

              <TextField
                label="Admin Password"
                name="adminPassword"
                type="password"
                value={state.adminPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />

              <button
                type="submit"
                className="w-full py-2 px-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={state.submitting}
              >
                {state.submitting ? (
                  <Loader2 className="mr-2 w-4 h-4" />
                ) : (
                  "Create School Account"
                )}
              </button>

              {state.error && (
                <Alert variant="error">
                  <span>{state.error}</span>
                </Alert>
              )}

              {state.success && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Account created! Check your email (it is auto-confirmed) and <a
                    href="/sign-in"
                    className="underline text-primary-600 hover:text-primary-500"
                  >
                    sign in here
                  </a> to access your dashboard.
                </p>
              )}
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account? <a href="/sign-in" className="underline text-primary-600 hover:text-primary-500">
            sign in here
          </a>
        </p>
      </main>
    </div>
  );
}

export default SchoolRegisterPage;