"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-[3px] border border-[#435266] bg-[#3a4659] px-3 py-2 text-sm text-[#c7d5e0] hover:bg-[#4a5970]"
    >
      Sign Out
    </button>
  );
}
