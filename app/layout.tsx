import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "FRC Parts Tracker Demo",
  description: "Manufactured parts tracker for FRC robotics teams."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getUserIdFromCookieStore();
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
    : null;

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="row">
              <span className="brand">FRC Parts Tracker</span>
              <nav className="topnav">
                <Link href="/">Parts</Link>
                <Link href="/import">Import BOM</Link>
              </nav>
            </div>
            <span className="muted">{user ? `Signed in: ${user.displayName}` : "Not signed in"}</span>
          </header>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
