import { AuthCard } from "@/components/auth/auth-card";
import { signOut } from "@/modules/auth/actions";

// Shown to a signed-in user who is neither a founder nor a member of any
// company. Staff join by invitation, so this usually means their invite
// hasn't been accepted yet, or access was removed.
export default function NoAccessPage() {
  return (
    <AuthCard title="No access yet">
      <p className="text-sm text-gray-600">
        Your account isn&apos;t linked to a company. Staff access to Join Care
        Now is granted by invitation. If you&apos;re expecting access, ask your
        administrator to send (or re-send) your invitation.
      </p>
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
