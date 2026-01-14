import { redirect } from "next/navigation"
import AdminPermissionsClientPage from "./permissions-client"
import { isFeatureEnabledServer } from "@/lib/feature-flags/server"

export default function AdminPermissionsPage() {
  if (!isFeatureEnabledServer("ADMIN_PERMISSIONS")) {
    redirect("/admin")
  }

  return <AdminPermissionsClientPage />
}
