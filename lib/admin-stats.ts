export interface AdminStats {
  totalUsers: number | null
  activeSessions: number | null
  storageUsed: string
  uptime: string
}

export async function getAdminStats(): Promise<AdminStats> {
  try {
    const response = await fetch('/api/admin/stats', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.message || 'Failed to fetch admin stats')
    }

    const data = await response.json() as AdminStats

    return data
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    // Return default values in case of error
    return {
      totalUsers: null,
      activeSessions: null,
      storageUsed: '0 GB',
      uptime: '0%'
    }
  }
}
