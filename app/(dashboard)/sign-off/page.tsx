import { PageHeader } from "@/components/dashboard/page-header";
import { SignOffList } from "@/components/dashboard/sign-off-list";
import { getSignOffQueue } from "@/modules/signoff/actions";

export default async function SignOffPage() {
  const docs = await getSignOffQueue();
  return (
    <div>
      <PageHeader
        title="Sign Off"
        subtitle="Check signed contracts and policies, then sign them off."
      />
      <SignOffList docs={docs} />
    </div>
  );
}
