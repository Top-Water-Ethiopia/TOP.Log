import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the user's role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get questions for the user's role from role_questions table
    const { data: questions, error: questionsError } = await supabase
      .from('role_questions')
      .select('*')
      .eq('role_id', profile.role_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (questionsError) {
      throw questionsError;
    }

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching report questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report questions' },
      { status: 500 }
    );
  }
}
