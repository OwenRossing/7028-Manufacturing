import { isDemoMode, isLocalMode } from "@/lib/app-mode";
import LoginClient from "./login-client";

export default function LoginPage() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;
  const googleAuthDomain = process.env.GOOGLE_AUTH_DOMAIN ?? null;
  const demoMode = isDemoMode();
  const localMode = isLocalMode();
  return <LoginClient googleClientId={googleClientId} googleAuthDomain={googleAuthDomain} demoMode={demoMode} localMode={localMode} />;
}
