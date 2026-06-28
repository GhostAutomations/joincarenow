import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/auth-card";
import { NewUserAcceptForm } from "@/components/auth/accept-invite-form";
import { acceptAsCurrentUser } from "@/modules/invitations/actions";
import { COMPANY_ROLE_LABEL as ROLE_LABEL } from "@/lib/roles";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <AuthCard title="Invitation link invalid">
        <p className="text-sm text-gray-600">
          This link is missing its invitation code. Please use the full link
          from your invitation email.
        </p>
      </AuthCard>
    );
  }

  const supabase = await createClient();

  const { data: invite } = await supabase
    .rpc("get_invitation", { p_token: token })
    .maybeSingle<{
      email: string;
      role: string;
      company_name: string;
      status: string;
      is_expired: boolean;
      invited_name: string | null;
    }>();

  if (!invite) {
    return (
      <AuthCard title="Invitation not found">
        <p className="text-sm text-gray-600">
          We couldn&apos;t find this invitation. It may have been revoked. Ask
          your administrator to send a new one.
        </p>
      </AuthCard>
    );
  }

  if (invite.status !== "pending" || invite.is_expired) {
    const reason =
      invite.status === "accepted"
        ? "This invitation has already been accepted."
        : invite.status === "revoked"
          ? "This invitation has been revoked."
          : "This invitation has expired.";
    return (
      <AuthCard title="Invitation unavailable">
        <p className="text-sm text-gray-600">{reason}</p>
        <p className="mt-4 text-sm text-gray-600">
          Already set up?{" "}
          <Link href={`/sign-in?email=${encodeURIComponent(invite.email)}`} className="text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  const roleLabel = ROLE_LABEL[invite.role] ?? invite.role;
  const subtitle = (
    <>
      You&apos;ve been invited to join{" "}
      <span className="font-medium text-gray-900">{invite.company_name}</span> as{" "}
      <span className="font-medium text-gray-900">{roleLabel}</span>.
    </>
  );

  // Is someone already signed in?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Case A: signed in with the SAME email — one-click accept.
  if (user && user.email?.toLowerCase() === invite.email.toLowerCase()) {
    return (
      <AuthCard title="Accept invitation" subtitle={subtitle}>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <form action={acceptAsCurrentUser}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Accept &amp; join {invite.company_name}
          </button>
        </form>
      </AuthCard>
    );
  }

  // Case B: signed in with a DIFFERENT email — must sign out first.
  if (user) {
    return (
      <AuthCard title="Wrong account" subtitle={subtitle}>
        <p className="text-sm text-gray-600">
          You&apos;re signed in as{" "}
          <span className="font-medium">{user.email}</span>, but this invitation
          was sent to{" "}
          <span className="font-medium">{invite.email}</span>. Please sign out
          and open the link again.
        </p>
        <p className="mt-4 text-sm">
          <Link href={`/sign-in?email=${encodeURIComponent(invite.email)}`} className="text-brand-600 hover:underline">
            Go to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  // Case C: not signed in — create the account (email locked to the invite).
  return (
    <AuthCard title="Accept your invitation" subtitle={subtitle}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <NewUserAcceptForm token={token} email={invite.email} defaultName={invite.invited_name ?? ""} />
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href={`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
          className="text-brand-600 hover:underline"
        >
          Sign in to accept
        </Link>
      </p>
    </AuthCard>
  );
}
