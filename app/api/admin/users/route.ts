import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { UserWithProfile, PaginatedUsersResponse } from '@/lib/supabase/admin.types'

// Enable dynamic route behavior
// This ensures we get fresh data on each request
export const dynamic = 'force-dynamic'

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'

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
  const isAdmin = profile.role_id === ADMIN_ROLE_ID || isSuperAdmin

  if (!isSuperAdmin && !isAdmin) {
    return { isAdmin: false, isSuperAdmin: false, error: 'Admin access required' }
  }

  return { isAdmin: true, isSuperAdmin, userId: user.id, roleId: profile.role_id }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, isSuperAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, name, role_id, department_id } = body

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Prevent admins (non-super admins) from creating users with super admin role
    if (role_id && role_id === SUPER_ADMIN_ROLE_ID && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admins can create users with super admin role' },
        { status: 403 }
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth using admin client
    // Supabase will automatically check for duplicate emails and return an error if the email exists
    const { data: authData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
    })

    if (createUserError) {
      console.error('Error creating auth user:', createUserError)
      
      // Check if the error is due to duplicate email
      if (createUserError.message?.toLowerCase().includes('already') || 
          createUserError.message?.toLowerCase().includes('exists') ||
          createUserError.message?.toLowerCase().includes('duplicate') ||
          createUserError.status === 422) {
        return NextResponse.json(
          { error: 'User with this email already exists', message: createUserError.message },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create user', message: createUserError.message },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile using admin client (bypasses RLS)
    const defaultRoleId = role_id || '00000000-0000-0000-0000-000000000002' // Default to user role
    
    // Use the department_id directly
    const departmentId = department_id || null;
    
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        name: name.trim(),
        department_id: departmentId,
        role_id: defaultRoleId,
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      // If profile creation fails, try to clean up the auth user
      console.error('Error creating user profile:', profileError)
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('Error cleaning up auth user:', deleteError)
      }
      
      return NextResponse.json(
        { error: 'Failed to create user profile', message: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        created_at: authData.user.created_at,
      },
      profile,
    }, { status: 201 })

  } catch (error) {
    console.error('Admin create user API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create user', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT - Update a user
export async function PUT(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, isSuperAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { user_id, name, email, department_id, role_id, is_active } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Prevent admins (non-super admins) from assigning super admin role
    if (role_id && role_id === SUPER_ADMIN_ROLE_ID && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admins can assign super admin role' },
        { status: 403 }
      )
    }

    // Validate name if provided
    if (name !== undefined && !name.trim()) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      )
    }

    // Validate email if provided
    if (email !== undefined) {
      if (!email.trim()) {
        return NextResponse.json(
          { error: 'Email cannot be empty' },
          { status: 400 }
        )
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }

      // Check if email is already taken by another user
      const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
      const emailTaken = existingUsers?.users?.some(
        u => u.id !== user_id && u.email === email
      )
      
      if (emailTaken) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 409 }
        )
      }

      // Update email in auth.users using admin client
      const { error: emailError } = await adminSupabase.auth.admin.updateUserById(
        user_id,
        { email }
      )

      if (emailError) {
        console.error('Error updating user email:', emailError)
        return NextResponse.json(
          { error: 'Failed to update email', message: emailError.message },
          { status: 500 }
        )
      }
    }

    // Update user profile
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (department_id !== undefined) {
      // Use the department_id directly
      updateData.department_id = department_id || null;
    }
    if (role_id !== undefined) updateData.role_id = role_id
    if (is_active !== undefined) updateData.is_active = is_active
    updateData.updated_at = new Date().toISOString()

    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', user_id)
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description
        )
      `)
      .single()

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to update user profile', message: profileError.message },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Get updated auth user data
    const { data: { user: authUser } } = await adminSupabase.auth.admin.getUserById(user_id)

    return NextResponse.json({
      user: {
        id: authUser?.id || user_id,
        email: authUser?.email || email,
        created_at: authUser?.created_at,
      },
      profile,
    })
  } catch (error) {
    console.error('Admin update user API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update user', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, isSuperAdmin, error: authVerifyError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authVerifyError || 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse pagination parameters from the URL
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '10')))
    const offset = (page - 1) * perPage

    // First, get the total count of all user profiles for pagination
    const { count: totalCount, error: countError } = await adminSupabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    // Fetch paginated user profiles with their role information
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('user_profiles')
      .select(`
        id,
        user_id,
        name,
        department_id,
        role_id,
        is_active,
        created_at,
        updated_at,
        last_login,
        roles:role_id (
          id,
          name,
          description
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (profilesError) throw profilesError

    // If no profiles found, return empty result
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          perPage,
          totalCount: 0,
          totalPages: 0
        }
      } as PaginatedUsersResponse)
    }

    // Get auth data for all users in one go
    const { data: { users: authUsers = [] }, error: authError } = 
      await adminSupabase.auth.admin.listUsers()
    
    if (authError) throw authError

    // Create a map of user IDs to auth data for quick lookup
    const authUsersMap = new Map(authUsers.map(user => [user.id, user]))

    // Combine the profile data with auth data
    const usersWithAuth: UserWithProfile[] = profiles.map((profile: any) => {
      const authUser = authUsersMap.get(profile.user_id)
      
      return {
        id: profile.user_id,
        email: authUser?.email || 'N/A',
        email_confirmed_at: authUser?.email_confirmed_at || null,
        user_metadata: authUser?.user_metadata || null,
        created_at: authUser?.created_at || profile.created_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        profile: {
          id: profile.id,
          name: profile.name,
          department_id: profile.department_id,
          role_id: profile.role_id,
          role_name: profile.roles?.name || 'user',
          is_active: profile.is_active,
          created_at: profile.created_at,
          last_login: profile.last_login
        }
      }
    })

    // Return the paginated response
    const response: PaginatedUsersResponse = {
      data: usersWithAuth,
      pagination: {
        page,
        perPage,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / perPage)
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch users', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
