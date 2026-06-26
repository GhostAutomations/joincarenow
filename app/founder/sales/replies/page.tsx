import { redirect } from "next/navigation";

// Replies merged into Conversations.
export default function RepliesRedirect() {
  redirect("/founder/sales/conversations");
}
