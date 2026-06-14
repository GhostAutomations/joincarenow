import { redirect } from "next/navigation";

// Staff self-signup is disabled. Staff join by invitation; applicants register
// through a job application. Anyone hitting this route is sent to sign-in.
export default function SignUpDisabled() {
  redirect("/sign-in");
}
