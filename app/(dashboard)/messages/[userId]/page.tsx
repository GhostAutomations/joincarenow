import { redirect } from "next/navigation";

/** Deep links open in the split-view Messages page. */
export default async function StaffThreadRedirect({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  redirect(`/messages?with=${userId}`);
}
