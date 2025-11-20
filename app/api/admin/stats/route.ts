import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

// Helper function to handle timeouts for Supabase operations
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]).catch((error) => {
    console.warn('Operation timed out or failed, using fallback:', error instanceof Error ? error.message : error)
    return fallback
  })
}

export async function GET() {
  try {
    // Get total users with timeout handling
    const { count: totalUsers, error: usersError } = await withTimeout(
      adminSupabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('user_id', 'is', null),
      5000,
      { count: null, error: null }
    )

    if (usersError) {
      console.warn('Error fetching user count:', usersError)
    }

    // Get active sessions with timeout handling
    // Note: auth.admin.listUsers() can timeout, so we wrap it in a timeout
    let activeSessions = 0
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

      // Use Promise.race with a timeout to prevent hanging
      const listUsersPromise = adminSupabase.auth.admin.listUsers()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('listUsers timeout after 8s')), 8000)
      })

      const {
        data: { users: authUsers = [] } = { users: [] },
        error: sessionsError
      } = await Promise.race([listUsersPromise, timeoutPromise]).catch((error) => {
        console.warn('Failed to fetch active sessions (timeout or error):', error instanceof Error ? error.message : error)
        return { data: { users: [] }, error: null }
      }) as { data: { users: any[] }, error: any }

      if (sessionsError) {
        console.warn('Error fetching active sessions:', sessionsError)
      } else if (authUsers && authUsers.length > 0) {
        activeSessions = authUsers.filter((user) => {
          if (!user.last_sign_in_at) return false
          return new Date(user.last_sign_in_at) > new Date(fifteenMinutesAgo)
        }).length
      }
    } catch (error) {
      console.warn('Failed to fetch active sessions, using fallback:', error)
      // Continue with activeSessions = 0
    }

    // Get storage usage with timeout handling
    let storageUsed = '0 GB'
    try {
      const { data: buckets, error: storageError } = await withTimeout(
        adminSupabase.storage.listBuckets(),
        5000,
        { data: [], error: null }
      )

      if (storageError) {
        console.warn('Error fetching storage buckets:', storageError)
      } else if (buckets && buckets.length > 0) {
        let totalSize = 0
        for (const bucket of buckets) {
          try {
            const { data: files, error: bucketFilesError } = await withTimeout(
              adminSupabase.storage
                .from(bucket.id)
                .list(undefined, { limit: 1000 }),
              3000,
              { data: [], error: null }
            )

            if (!bucketFilesError && files) {
              for (const file of files) {
                totalSize += file.metadata?.size || 0
              }
            }
          } catch (error) {
            console.warn(`Error fetching files from bucket ${bucket.id}:`, error)
            // Continue to next bucket
          }
        }

        storageUsed = totalSize > 0
          ? `${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB`
          : '0 GB'
      }
    } catch (error) {
      console.warn('Failed to fetch storage usage, using fallback:', error)
      // Continue with storageUsed = '0 GB'
    }

    return NextResponse.json({
      totalUsers: totalUsers ?? null,
      activeSessions,
      storageUsed,
      uptime: '99.9%'
    })
  } catch (error) {
    console.error('Admin stats API error:', error)

    // Return partial data even on error
    return NextResponse.json(
      {
        totalUsers: null,
        activeSessions: 0,
        storageUsed: '0 GB',
        uptime: '99.9%',
        error: 'Some stats could not be fetched',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 } // Return 200 with partial data instead of 500
    )
  }
}
