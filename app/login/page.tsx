"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { isDemoMode } from "@/lib/app-mode";

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

export default function LoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const demoMode = isDemoMode();
  const [demoUsers, setDemoUsers] = useState<Array<{ id: string; displayName: string; email: string }>>([]);

  async function onGoogleCredential(credential: string) {
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
  }

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
  }, [googleReady, googleClientId]);

  useEffect(() => {
    if (!demoMode) return;
    void fetch("/api/auth/demo-login")
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return (await response.json()) as { items?: Array<{ id: string; displayName: string; email: string }> };
      })
      .then((data) => setDemoUsers(data.items ?? []))
      .catch(() => setDemoUsers([]));
  }, [demoMode]);

  async function onDemoLogin(userId: string) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Unable to sign in as demo user.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
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
            Continue with Google. Only <span className="font-semibold">@stmarobotics.org</span> accounts are allowed.
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
                  onClick={() => onDemoLogin(user.id)}
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
            Google sign-in not configured. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`.
          </p>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </Card>
    </div>
  );
}
