import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'

// Enable dynamic route behavior
// This ensures we get fresh data on each request
export const dynamic = 'force-dynamic'

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"

/**
 * GET /api/admin/captain-log-entries
 * Fetch all captain log entries with user profiles and custom responses
 * Admin and Super Admin only
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication with timeout
    let userData: { data: { user: any }, error: any } | null = null;
    try {
      // Add timeout to prevent hanging requests
      const userPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 5000)
      );
      
      userData = await Promise.race([userPromise, timeoutPromise]) as { data: { user: any }, error: any };
    } catch (timeoutError: any) {
      console.error('Auth check timeout:', timeoutError);
      return NextResponse.json(
        { error: 'Authentication timeout' },
        { status: 500 }
      );
    }
    
    const { data: { user }, error: authError } = userData || { data: { user: null }, error: 'Unknown error' };
    
    console.log('=== AUTH DEBUG ===')
    console.log('Auth error:', authError)
    console.log('User data:', user)
    console.log('==================')
    
    if (authError || !user) {
      console.log('Authentication failed - returning 401')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin or super admin with timeout
    let profileData: { data: any, error: any } | null = null;
    try {
      // Add timeout to prevent hanging requests
      const profilePromise = supabase
        .from('user_profiles')
        .select('role_id')
        .eq('user_id', user.id)
        .single();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile check timeout')), 5000)
      );
      
      profileData = await Promise.race([profilePromise, timeoutPromise]) as { data: any, error: any };
    } catch (timeoutError: any) {
      console.error('Profile check timeout:', timeoutError);
      return NextResponse.json(
        { error: 'Profile check timeout' },
        { status: 500 }
      );
    }
    
    const { data: profile, error: profileError } = profileData || { data: null, error: 'Unknown error' };
      
    console.log('=== PROFILE DEBUG ===')
    console.log('Profile error:', profileError)
    console.log('Profile data:', profile)
    console.log('=====================')

    if (profileError || !profile) {
      console.log('Profile not found or error occurred - returning 404')
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const isAdmin = (profile as any).role_id === ADMIN_ROLE_ID || (profile as any).role_id === SUPER_ADMIN_ROLE_ID
    
    console.log('=== ROLE DEBUG ===')
    console.log('User role_id:', (profile as any).role_id)
    console.log('Is admin check:', isAdmin)
    console.log('==================')

    if (!isAdmin) {
      console.log('User is not admin - returning 403')
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Fetch all captain log entries
    // Use adminSupabase to bypass RLS and get ALL entries for admin view
    const { data: entries, error: entriesError } = await adminSupabase
      .from('captain_log_entries')
      .select('*')
      .order('created_at', { ascending: false })
      
    console.log('Entries fetched:', entries?.length || 0)
    console.log('Sample entry:', entries?.[0])
    
    if (entriesError) {
      console.error('Error fetching entries:', entriesError)
      return NextResponse.json(
        { error: 'Failed to fetch entries', details: entriesError },
        { status: 500 }
      )
    }

    // Fetch ALL users (for dropdown - not just those with entries)
    // Use adminSupabase to bypass RLS and get all users
    const { data: allUsers, error: allUsersError } = await adminSupabase
      .from('user_profiles')
      .select('user_id, name, role_id, department_id')
      .eq('is_active', true)
      .order('name')
      
    console.log('Users fetched:', allUsers?.length || 0)
    console.log('Sample user:', allUsers?.[0])

    if (allUsersError) {
      console.error('Error fetching all users:', allUsersError)
    }

    // Fetch emails from auth.users for the user profiles
    let userEmailMap = new Map<string, string>()
    if (allUsers && allUsers.length > 0) {
      const userIds = (allUsers as any[]).map(u => u.user_id)
      const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
      
      if (authUsers?.users) {
        authUsers.users.forEach(authUser => {
          if (userIds.includes(authUser.id)) {
            userEmailMap.set(authUser.id, authUser.email || '')
          }
        })
      }
    }

    console.log('✅ Fetched users for dropdown:', allUsers?.length || 0)

    // Fetch ALL roles (for dropdown)
    // Use adminSupabase to bypass RLS
    const { data: allRoles, error: allRolesError } = await adminSupabase
      .from('roles')
      .select('id, name')
      .order('name')

    if (allRolesError) {
      console.error('Error fetching all roles:', allRolesError)
    }

    console.log('✅ Fetched roles for dropdown:', allRoles?.length || 0)

    // Fetch ALL departments (for dropdown)
    // Use adminSupabase to bypass RLS
    const { data: allDepartments, error: allDeptsError } = await adminSupabase
      .from('departments')
      .select('id, name')
      .order('name')

    if (allDeptsError) {
      console.error('Error fetching all departments:', allDeptsError)
    }

    console.log('✅ Fetched departments for dropdown:', allDepartments?.length || 0)

    // If no entries, return empty result with filter options
    if (!entries || entries.length === 0) {
      return NextResponse.json({
        entries: [],
        users: (allUsers as any[])?.map(u => ({
          id: u.user_id,
          name: u.name || 'Unknown User',
          email: userEmailMap.get(u.user_id) || '',
        })) || [],
        roles: (allRoles as any[])?.map(r => ({ id: r.id, name: r.name })) || [],
        departments: (allDepartments as any[])?.map(d => ({ id: d.id, name: d.name })) || [],
      })
    }

    // Create lookup maps for roles and departments
    const roleMap = new Map((allRoles as any[])?.map(r => [r.id, r.name]) || [])
    const deptMap = new Map((allDepartments as any[])?.map(d => [d.id, d.name]) || [])

    // Create user profile lookup map
    const userMap = new Map(
      (allUsers as any[])?.map(u => [
        u.user_id,
        {
          user_id: u.user_id,
          name: u.name || 'Unknown User',
          email: userEmailMap.get(u.user_id) || '',
          role_name: roleMap.get(u.role_id) || 'Unknown',
          department_name: deptMap.get(u.department_id) || null,
        }
      ]) || []
    )
    
    console.log('UserMap created with', userMap.size, 'entries')
    console.log('Sample user IDs in userMap:', Array.from(userMap.keys()).slice(0, 5))
    
    // Check if entries have matching user profiles
    console.log('Checking user ID matches:')
    const entryUserIds = new Set(entries.map(e => e.user_id))
    const userProfileIds = new Set((allUsers as any[])?.map(u => u.user_id) || [])
    console.log('Entry user IDs:', Array.from(entryUserIds))
    console.log('User profile IDs:', Array.from(userProfileIds))
    
    const missingUserIds = Array.from(entryUserIds).filter(id => !userProfileIds.has(id))
    console.log('Missing user IDs in profiles:', missingUserIds)

    // Fetch custom responses for all entries
    // Use adminSupabase to bypass RLS
    const entryIds = (entries as any[]).map(e => e.id)
    const { data: customResponses, error: responsesError } = await adminSupabase
      .from('custom_responses')
      .select('*')
      .in('entry_id', entryIds)
      .order('timestamp')

    if (responsesError) {
      console.error('Error fetching custom responses:', responsesError)
    }

    console.log(`Fetched ${entries.length} entries, ${allUsers?.length || 0} users, ${allRoles?.length || 0} roles, ${allDepartments?.length || 0} departments, ${customResponses?.length || 0} responses`)

    // Create responses lookup map
    const responsesMap = new Map<string, any[]>()
    ;(customResponses as any[])?.forEach(response => {
      const entryResponses = responsesMap.get(response.entry_id) || []
      entryResponses.push({
        question_id: response.question_id,
        question_key: response.question_key,
        question_label: response.question_label,
        question_type: response.question_type,
        value: response.value,
      })
      responsesMap.set(response.entry_id, entryResponses)
    })

    // Enrich entries with user profiles and custom responses
    const enrichedEntries = (entries as any[]).map(entry => ({
      ...entry,
      user_profile: userMap.get(entry.user_id) || null,
      custom_responses: responsesMap.get(entry.id) || [],
    }))
    
    console.log('Enriched entries count:', enrichedEntries.length)
    console.log('Sample enriched entry:', enrichedEntries[0])
    console.log('Entry user_id:', enrichedEntries[0]?.user_id)
    console.log('User profile found:', !!enrichedEntries[0]?.user_profile)
    
    // Return enriched entries along with filter options
    return NextResponse.json({
      entries: enrichedEntries,
      users: (allUsers as any[])?.map(u => ({
        id: u.user_id,
        name: u.name || 'Unknown User',
        email: userEmailMap.get(u.user_id) || '',
      })) || [],
      roles: (allRoles as any[])?.map(r => ({ id: r.id, name: r.name })) || [],
      departments: (allDepartments as any[])?.map(d => ({ id: d.id, name: d.name })) || [],
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/captain-log-entries:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
