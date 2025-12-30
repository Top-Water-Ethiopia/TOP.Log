import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Enable dynamic route behavior
export const dynamic = 'force-dynamic'

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'

// Helper to verify admin or super admin access
async function verifyAdmin() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Auth error in verifyAdmin:', userError)
      return { isAdmin: false, error: 'Not authenticated' }
    }
    
    if (!user) {
      console.warn('No user found in verifyAdmin')
      return { isAdmin: false, error: 'Not authenticated' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role_id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error in verifyAdmin:', profileError)
      return { isAdmin: false, error: 'Admin access required' }
    }

    if (!profile) {
      console.warn(`User ${user.id} has no profile`)
      return { isAdmin: false, error: 'Admin access required' }
    }

    const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
    const isAdmin = profile.role_id === ADMIN_ROLE_ID

    if (!isSuperAdmin && !isAdmin) {
      console.warn(`User ${user.id} is not admin. Role ID: ${profile?.role_id}`)
      return { isAdmin: false, error: 'Admin access required' }
    }

    return { isAdmin: true, userId: user.id }
  } catch (error) {
    console.error('Unexpected error in verifyAdmin:', error)
    return { isAdmin: false, error: 'Authentication error' }
  }
}

// GET - List all departments
export async function GET() {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const { data: departments, error } = await adminSupabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching departments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch departments', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: departments || [] })
  } catch (error) {
    console.error('Admin departments API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch departments', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST - Create a new department
export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, is_active } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      )
    }

    // Check if department with same name already exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase
      .from('departments')
      .select('id, name')

    const existing = allDepartments?.find(
      d => d.name.toLowerCase() === name.trim().toLowerCase()
    )

    if (existing) {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      )
    }

    // Create department using admin client (bypasses RLS)
    const { data: department, error } = await adminSupabase
      .from('departments')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== undefined ? is_active : true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating department:', error)
      return NextResponse.json(
        { error: 'Failed to create department', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error) {
    console.error('Admin create department API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create department', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT - Update a department
export async function PUT(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError, userId } = await verifyAdmin()
    if (!isAdmin || !userId) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, description, is_active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      )
    }

    // Check if another department with same name exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase
      .from('departments')
      .select('id, name')

    const existing = allDepartments?.find(
      d => d.id !== id && d.name.toLowerCase() === name.trim().toLowerCase()
    )

    if (existing) {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      )
    }

    // Update department using admin client
    const { data: department, error } = await adminSupabase
      .from('departments')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== undefined ? is_active : true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating department:', error)
      return NextResponse.json(
        { error: 'Failed to update department', message: error.message },
        { status: 500 }
      )
    }

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error('Admin update department API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update department', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a department
export async function DELETE(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: authError || 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      )
    }

    // Check if department has any roles assigned
    const { data: roles, error: rolesError } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('department_id', id)
      .limit(1)

    if (rolesError) {
      console.error('Error checking roles:', rolesError)
      // Continue with deletion attempt
    }

    if (roles && roles.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department. It has roles assigned. Please remove all roles first.' },
        { status: 409 }
      )
    }

    // Delete department using admin client
    const { error } = await adminSupabase
      .from('departments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting department:', error)
      return NextResponse.json(
        { error: 'Failed to delete department', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete department API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete department', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

