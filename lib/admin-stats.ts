import { apiFetch } from "@/lib/api-client"

export interface AdminStats {
  totalUsers: number | null
  activeSessions: number | null
  storageUsed: string
  uptime: string
}

const DEFAULT_ADMIN_STATS: AdminStats = {
  totalUsers: null,
  activeSessions: null,
  storageUsed: "0 GB",
  uptime: "0%",
}

export async function getAdminStats(): Promise<AdminStats> {
  try {
    return await apiFetch<AdminStats>("/api/admin/stats", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })
  } catch {
    return DEFAULT_ADMIN_STATS
  }
}
