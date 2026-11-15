import Link from "next/link";
import type { Metadata } from "next";

/**
 * School signup / onboarding page.
 *
 * New schools use this page to create an account and get started with
 * the School Management Platform. After signing up, schools receive a
 * unique code and can invite staff and administrators.
 */
export default function SignupPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-6">
          Get your school set up
        </h1>

        <p className="text-center text-muted-foreground mb-8">
          Create your school account in just a few minutes. Once you're signed
          up, you'll be able to add classes, invite teachers, and track
          student attendance and results.
        </p>

        <form className="border rounded-lg p-8 max-w-md mx-auto space-y-6 border-border">
          <h2 className="text-xl font-semibold text-center mb-6">
            Start your school account
          </h2>

          <div>
            <label className="block text-sm font-medium mb-2">
              School name
            </label>
            <input
              type="text"
              placeholder="e.g. ABC Academy"
              className="w-full rounded border border-border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              School code (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. ABC-001"
              className="w-full rounded border border-border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used to identify your school. Can be left blank and generated later.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Or continue with
            </label>
            <p className="text-sm text-muted-foreground">
              Or continue with
            </p>
            <div className="flex gap-2 mt-2">
              {/* Social sign-in buttons would go here */}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account? <Link href="/sign-in" className="font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}