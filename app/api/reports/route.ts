import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (clientError) {
      console.error('Error creating Supabase client:', clientError);
      return NextResponse.json({ 
        error: 'Failed to initialize client',
        details: clientError instanceof Error ? clientError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    if (!supabase) {
      console.error('Supabase client is undefined');
      return NextResponse.json({ error: 'Failed to initialize client' }, { status: 500 });
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    // Fetch all report answers
    const { data: answers, error: answersError } = await supabase
      .from('report_answers')
      .select(`
        id,
        report_id,
        question_id,
        answer,
        created_at,
        role_questions:question_id (
          id,
          question_key,
          question_label,
          question_type
        )
      `);

    if (answersError) {
      console.error('Error fetching report answers:', answersError);
      return NextResponse.json({ error: 'Failed to fetch report answers' }, { status: 500 });
    }

    // Group answers by report_id
    const answersByReport = (answers || []).reduce((acc, answer) => {
      if (!acc[answer.report_id]) {
        acc[answer.report_id] = [];
      }
      acc[answer.report_id].push(answer);
      return acc;
    }, {} as Record<string, typeof answers>);

    // Fetch user profiles for all unique user IDs
    const userIds = [...new Set((reports || []).map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, name')
      .in('user_id', userIds);

    // Fetch user emails from auth.users (if accessible)
    const profilesMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Combine reports with their answers and user info
    const reportsWithAnswers = (reports || []).map(report => {
      const reportAnswers = answersByReport[report.id] || [];
      const profile = profilesMap.get(report.user_id);
      return {
        ...report,
        answers: reportAnswers,
        user_name: profile?.name || 'Unknown User',
        user_email: null, // Email would need to come from auth.users which may not be directly queryable
      };
    });

    return NextResponse.json(reportsWithAnswers);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

