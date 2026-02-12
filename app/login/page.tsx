"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("alex@team7028.org");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to sign in.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <section className="panel stack" style={{ maxWidth: 480, margin: "40px auto" }}>
      <h1 style={{ margin: 0 }}>Demo Sign In</h1>
      <p className="muted" style={{ margin: 0 }}>
        Use a seeded team account to access the tracker.
      </p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="stack">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      </form>
    </section>
  );
}
