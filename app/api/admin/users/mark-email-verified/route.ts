import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Enable dynamic route behavior
export const dynamic = 'force-dynamic'

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'
const SYSTEM_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000010'

// Helper to verify admin or super admin access
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { isAdmin: false, isSuperAdmin: false, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role_id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, isSuperAdmin: false, error: 'Admin access required' }
  }

  const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isSuperAdmin && !isAdmin) {
    return { isAdmin: false, isSuperAdmin: false, error: 'Admin access required' }
  }

  return { isAdmin: true, isSuperAdmin, userId: user.id, roleId: profile.role_id }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Mark email as verified using Supabase admin API
    // Update both email_confirm flag and user metadata in one call
    const { data: emailData, error: emailError } = await adminSupabase.auth.admin.updateUserById(user_id, {
      email_confirm: true,
      user_metadata: { email_verified: true }
    })

    if (emailError) {
      console.error('Failed to mark email as verified:', emailError)
      return NextResponse.json(
        { 
          error: 'Failed to mark email as verified', 
          message: emailError.message 
        },
        { status: 500 }
      )
    }

    // Get updated user data to return
    const { data: updatedUser, error: fetchError } = await adminSupabase.auth.admin.getUserById(user_id)
    
    if (fetchError) {
      console.error('Failed to fetch updated user data:', fetchError)
      // Return the emailData we have even if we can't fetch the full user
      return NextResponse.json({ 
        success: true, 
        message: 'Email marked as verified successfully',
        user: emailData
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email marked as verified successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Mark email as verified API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to mark email as verified', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}