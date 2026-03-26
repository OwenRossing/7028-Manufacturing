"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "small" | "medium" | "large";
              shape?: "rectangular" | "pill";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: string;
            }
          ) => void;
        };
      };
    };
  }
}

type User = { id: string; displayName: string; email: string };

type Props = {
  googleClientId: string | null;
  googleAuthDomain: string | null;
  demoMode: boolean;
  localMode: boolean;
};

export default function LoginClient({ googleClientId, googleAuthDomain, demoMode, localMode }: Props) {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);

  // Local mode state
  const [entryKey, setEntryKey] = useState("");
  const [localUsers, setLocalUsers] = useState<User[] | null>(null);

  const onGoogleCredential = useCallback(async (credential: string) => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to sign in with Google.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButtonRef.current) return;
    const id = window.google?.accounts?.id;
    if (!id) return;
    id.initialize({
      client_id: googleClientId,
      callback: ({ credential }) => {
        void onGoogleCredential(credential);
      }
    });
    googleButtonRef.current.innerHTML = "";
    id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "signin_with",
      width: "340"
    });
  }, [googleReady, googleClientId, onGoogleCredential]);

  useEffect(() => {
    if (!demoMode) return;
    void fetch("/api/auth/demo-login")
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return (await response.json()) as { items?: User[] };
      })
      .then((data) => setDemoUsers(data.items ?? []))
      .catch(() => setDemoUsers([]));
  }, [demoMode]);

  async function onDemoLogin(userId: string) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to sign in as demo user.");
        setLoading(false);
        return;
      }

      // Use hard navigation fallback for mobile/LAN cases where client routing can stall.
      window.location.assign("/");
    } catch {
      setError("Unable to sign in as demo user.");
      setLoading(false);
    }
  }

  async function onSubmitKey(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/local-login/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: entryKey })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Invalid entry key.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { items: User[] };
      setLocalUsers(data.items);
    } catch {
      setError("Unable to verify entry key.");
    }
    setLoading(false);
  }

  async function onLocalLogin(userId: string) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ key: entryKey, userId })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to sign in.");
        setLoading(false);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Unable to sign in.");
      setLoading(false);
    }
  }

  if (localMode) {
    return (
      <div className="mx-auto mt-14 max-w-md">
        <Card className="space-y-4">
          <h1 className="text-2xl font-bold text-white">Sign In</h1>
          {localUsers === null ? (
            <form onSubmit={(e) => { void onSubmitKey(e); }} className="space-y-3">
              <p className="text-sm text-steel-300">Enter the team access key to continue.</p>
              <input
                type="password"
                value={entryKey}
                onChange={(e) => setEntryKey(e.target.value)}
                placeholder="Entry key"
                disabled={loading}
                autoFocus
                className="w-full rounded border border-[#3b4c63] bg-[#1d2633] px-3 py-2 text-sm text-[#d6e4f2] placeholder-[#5a7a99] outline-none focus:border-[#5a8ab5] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !entryKey}
                className="w-full rounded bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue
              </button>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-steel-300">Select your account</p>
              <div className="grid gap-2">
                {localUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => { void onLocalLogin(user.id); }}
                    disabled={loading}
                    className="rounded border border-[#3b4c63] bg-[#1d2633] px-3 py-2 text-left text-sm text-[#d6e4f2] hover:bg-[#253245] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="font-semibold">{user.displayName}</div>
                    <div className="text-xs text-[#9fb0c2]">{user.email}</div>
                  </button>
                ))}
                {!localUsers.length ? (
                  <p className="text-xs text-yellow-200">No users found.</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => { setLocalUsers(null); setEntryKey(""); setError(null); }}
                className="text-xs text-steel-300 hover:text-white"
              >
                ← Back
              </button>
            </div>
          )}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-14 max-w-md">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Sign In</h1>
        {demoMode ? (
          <p className="text-sm text-steel-300">Demo mode is enabled. Pick a demo account or use Google sign-in.</p>
        ) : (
          <p className="text-sm text-steel-300">
            Continue with your Google account.{googleAuthDomain ? <> Only <span className="font-semibold">@{googleAuthDomain}</span> accounts are allowed.</> : null}
          </p>
        )}
        {demoMode ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-steel-300">Demo Accounts</p>
            <div className="grid gap-2">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { void onDemoLogin(user.id); }}
                  disabled={loading}
                  className="rounded border border-[#3b4c63] bg-[#1d2633] px-3 py-2 text-left text-sm text-[#d6e4f2] hover:bg-[#253245] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="font-semibold">{user.displayName}</div>
                  <div className="text-xs text-[#9fb0c2]">{user.email}</div>
                </button>
              ))}
              {!demoUsers.length ? (
                <p className="text-xs text-yellow-200">No demo users found. Run `npm run prisma:seed`.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {googleClientId ? (
          <div className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
            <div ref={googleButtonRef} />
          </div>
        ) : (
          <p className="text-xs text-yellow-200">
            Google sign-in not configured. Set <code>GOOGLE_CLIENT_ID</code> in your environment.
          </p>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </Card>
    </div>
  );
}
