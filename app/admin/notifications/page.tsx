import { redirect } from "next/navigation"
import AdminNotificationsClientPage from "./notifications-client"
import { isFeatureEnabledServer } from "@/lib/feature-flags/server"

export default function AdminNotificationsPage() {
  if (!isFeatureEnabledServer("ADMIN_NOTIFICATIONS")) {
    redirect("/admin")
  }

  return <AdminNotificationsClientPage />
}
