import Link from "next/link";
import { PartStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";
import { isAdminUser } from "@/lib/permissions";
import { AdminUsersPanel } from "@/components/admin-users-panel";

export default async function SettingsPage() {
  const userId = await getUserIdFromCookieStore();
  const [user, myOpen, myDone, managedProjects, isAdmin] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true }
        })
      : Promise.resolve(null),
    userId
      ? prisma.part.count({
          where: {
            owners: { some: { userId } },
            status: { not: PartStatus.DONE }
          }
        })
      : Promise.resolve(0),
    userId
      ? prisma.part.count({
          where: {
            owners: { some: { userId } },
            status: PartStatus.DONE
          }
        })
      : Promise.resolve(0),
    prisma.project.count(),
    userId ? isAdminUser(userId) : Promise.resolve(false)
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 p-4">
      <Card className="border border-[#3a4f66] bg-[linear-gradient(120deg,rgba(23,32,44,0.96),rgba(33,46,62,0.92))] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8fa6be]">Profile</p>
            <h1 className="mt-1 text-3xl font-bold text-white">{user ? user.displayName : "Account"}</h1>
          </div>
          <SignOutButton />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border border-[#30475f] bg-[#1a2431] p-4">
          <p className="text-xs uppercase tracking-wide text-[#8fa6be]">Open parts</p>
          <p className="mt-2 text-3xl font-semibold text-[#d7e7f7]">{myOpen}</p>
        </Card>
        <Card className="border border-[#30475f] bg-[#1a2431] p-4">
          <p className="text-xs uppercase tracking-wide text-[#8fa6be]">Completed</p>
          <p className="mt-2 text-3xl font-semibold text-[#d7e7f7]">{myDone}</p>
        </Card>
        <Card className="border border-[#30475f] bg-[#1a2431] p-4">
          <p className="text-xs uppercase tracking-wide text-[#8fa6be]">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-[#d7e7f7]">{managedProjects}</p>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/?tab=board" className="block">
          <Card className="clickable-surface border border-[#315170] bg-[linear-gradient(135deg,rgba(24,36,49,0.95),rgba(34,50,68,0.92))] p-4">
            <h2 className="text-lg font-semibold text-white">Workspace</h2>
            <p className="mt-1 text-sm text-[#9fb2c6]">Return to board and active parts queue.</p>
          </Card>
        </Link>
        {isAdmin ? (
          <Link href="/projects" className="block">
            <Card className="clickable-surface border border-[#315170] bg-[linear-gradient(135deg,rgba(24,36,49,0.95),rgba(34,50,68,0.92))] p-4">
              <h2 className="text-lg font-semibold text-white">Admin tools</h2>
              <p className="mt-1 text-sm text-[#9fb2c6]">Manage projects, teams, and workspace config.</p>
            </Card>
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <Card className="border border-[#2f465f] bg-[#182330] p-1 sm:p-2">
          <AdminUsersPanel />
        </Card>
      ) : null}
    </section>
  );
}
