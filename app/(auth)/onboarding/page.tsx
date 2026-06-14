import { redirect } from "next/navigation";

// Self-serve company creation is disabled. Companies are provisioned by the
// founder in /admin; staff join by invitation. Route through /dashboard, which
// sends founders to /admin and everyone else to the right place.
export default function OnboardingDisabled() {
  redirect("/dashboard");
}
