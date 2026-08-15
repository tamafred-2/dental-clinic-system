"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function canUseDashboard(user: AuthUser) {
  return user.role === "ADMIN" || user.role === "STAFF";
}

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!active || !response.ok) return;
        const result = (await response.json()) as { user: AuthUser };
        if (canUseDashboard(result.user)) {
          router.replace("/admin");
        }
      } catch {
        // The login form remains available when the API is temporarily offline.
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json().catch(() => null)) as {
        user?: AuthUser;
        message?: string | string[];
      } | null;

      if (!response.ok || !result?.user) {
        throw new Error(
          typeof result?.message === "string"
            ? result.message
            : "Unable to sign in. Check your details and try again.",
        );
      }
      if (!canUseDashboard(result.user)) {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        throw new Error("This account cannot access the staff dashboard.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section
        className="admin-login-panel"
        aria-labelledby="admin-login-title"
      >
        <div className="admin-login-tools">
          <Link href="/">Back to website</Link>
          <ThemeToggle />
        </div>
        <div className="admin-login-heading">
          <span className="brand-symbol" aria-hidden="true">
            DC
          </span>
          <p className="eyebrow">Private staff area</p>
          <h1 id="admin-login-title">Clinic dashboard</h1>
          <p>
            Sign in with an authorized clinic account. Patient information is
            shown only inside this protected area.
          </p>
        </div>

        <form className="admin-login-form" onSubmit={submit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="button button-primary admin-submit"
            type="submit"
            disabled={submitting || checkingSession}
          >
            {checkingSession
              ? "Checking session…"
              : submitting
                ? "Signing in…"
                : "Sign in securely"}
          </button>
        </form>
      </section>
      <aside className="admin-login-note" aria-label="Dashboard purpose">
        <p className="eyebrow">Clinic operations</p>
        <h2>One clear place for the day ahead.</h2>
        <p>
          Review pending requests, confirm visits, check the calendar, and keep
          schedule changes inside the clinic workflow.
        </p>
      </aside>
    </main>
  );
}
