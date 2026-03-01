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
    <section className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Account</h1>
        <p className="text-sm text-steel-300">
          {user ? user.displayName : "Signed out"}
        </p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-steel-300">Open Parts</p>
          <p className="text-2xl font-semibold text-white">{myOpen}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-steel-300">Completed Parts</p>
          <p className="text-2xl font-semibold text-white">{myDone}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-steel-300">Projects</p>
          <p className="text-2xl font-semibold text-white">{managedProjects}</p>
        </Card>
      </div>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Permission Rules</h2>
        <p className="text-sm text-steel-300">
          Signed-in non-admin users can claim open roles and then edit parts they are assigned to.
        </p>
        <div className="space-y-1 text-sm text-steel-200">
          <p>Signed out: read-only.</p>
          <p>Signed in (not assigned): can claim open machinist/finisher roles.</p>
          <p>Signed in (assigned): can edit status, owners, details, and media for assigned parts.</p>
          <p>Admin: can manage all parts and admin tools.</p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {isAdmin ? (
          <Link href="/projects">
            <Card className="clickable-surface space-y-2">
              <h2 className="text-lg font-semibold text-white">Project Admin</h2>
              <p className="text-sm text-steel-300">Create projects and run admin tasks.</p>
            </Card>
          </Link>
        ) : null}
        <Link href="/">
          <Card className="clickable-surface space-y-2">
            <h2 className="text-lg font-semibold text-white">Back To Workspace</h2>
            <p className="text-sm text-steel-300">Return to Home, Community, and Parts flow.</p>
          </Card>
        </Link>
      </div>

      {isAdmin ? <AdminUsersPanel /> : null}
    </section>
  );
}
