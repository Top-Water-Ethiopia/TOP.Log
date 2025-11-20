import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReportsList } from '@/components/reports-list';
import { Card, CardContent } from '@/components/ui/card';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardContent className="pt-6">
          <ReportsList />
        </CardContent>
      </Card>
    </div>
  );
}

