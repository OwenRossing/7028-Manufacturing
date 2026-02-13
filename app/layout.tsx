import type { Metadata } from "next";
import "./globals.css";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/app-header";

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
  const [user, projects] = await Promise.all([
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
      : Promise.resolve(null),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return (
    <html lang="en">
      <body>
        <Providers>
          <AppHeader userName={user?.displayName ?? null} projects={projects} />
          <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
