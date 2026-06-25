import { requireCompany } from "@/modules/auth/queries";
import { getNotificationPrefs } from "@/modules/notifications/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { NotificationPrefsForm } from "@/components/dashboard/notification-prefs-form";

// Personal notification preferences — available to every signed-in staff member
// (job owners can be operational roles, who can't reach admin Settings).
export default async function NotificationPreferencesPage() {
  await requireCompany();
  const prefs = await getNotificationPrefs();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" subtitle="Choose how you're notified about activity on jobs you manage." />

      <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-6">
        <NotificationPrefsForm prefs={prefs} />
        <p className="mt-5 text-xs text-gray-500">
          These settings are personal to you. As a job&apos;s owner you receive its applicant notifications; turn off
          email here if you&apos;d rather only see them in the app.
        </p>
      </div>
    </div>
  );
}
