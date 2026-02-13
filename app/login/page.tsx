"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto mt-14 max-w-md">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Sign In</h1>
        <p className="text-sm text-steel-300">Use a seeded demo account.</p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </Card>
    </div>
  );
}
