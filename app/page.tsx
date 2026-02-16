import { PartsExplorer } from "@/components/parts-explorer";
import { getUserIdFromCookieStore } from "@/lib/auth";

export default async function HomePage() {
  const currentUserId = await getUserIdFromCookieStore();
  return <PartsExplorer currentUserId={currentUserId ?? null} />;
}
