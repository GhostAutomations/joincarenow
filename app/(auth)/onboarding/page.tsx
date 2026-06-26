import { redirect } from "next/navigation";

// Self-serve company creation is disabled. Companies are provisioned by the
// founder in /founder; staff join by invitation. Route through /dashboard, which
// sends founders to /founder and everyone else to the right place.
export default function OnboardingDisabled() {
  redirect("/dashboard");
}
