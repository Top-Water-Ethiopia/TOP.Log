import { redirect } from "next/navigation"
import { isFeatureEnabledServer } from "@/lib/feature-flags/server"

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabledServer("SELF_SERVICE_AUTH")) {
    redirect("/login")
  }

  return children
}
