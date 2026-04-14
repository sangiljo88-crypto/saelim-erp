import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  getNotifications,
  getWebhookConfigs,
} from "@/lib/notifications";
import NotificationSettingsClient from "./NotificationSettingsClient";

export default async function NotificationSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const notifications = await getNotifications(session.id, 50);
  const isAdmin = session.role === "coo" || session.role === "ceo";
  const webhooks = isAdmin ? await getWebhookConfigs() : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} subtitle="알림 설정" />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <NotificationSettingsClient
          userId={session.id}
          initialNotifications={notifications}
          isAdmin={isAdmin}
          initialWebhooks={webhooks}
        />
      </main>
    </div>
  );
}
