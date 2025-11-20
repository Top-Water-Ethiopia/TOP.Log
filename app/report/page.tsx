import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReportForm } from '@/components/report/ReportForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Daily Report</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportForm />
        </CardContent>
      </Card>
    </div>
  );
}
