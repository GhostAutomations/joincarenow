import { redirect } from "next/navigation";

// Forms are now created blank straight into the builder (Create a form button),
// where they're named. This route is retired.
export default function NewFormRedirect() {
  redirect("/forms");
}
