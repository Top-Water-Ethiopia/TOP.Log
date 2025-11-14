"use client";

import { useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { useSupabaseLog } from "@/contexts/supabase-log-context";
import { useSupabaseRbac } from "@/hooks/use-supabase-rbac";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SupabaseSandbox } from "@/components/supabase-sandbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarIcon, ArrowRightIcon, SettingsIcon, UserIcon, DatabaseIcon, CheckIcon, XIcon, ClockIcon } from "lucide-react";

export default function SupabaseDashboardPage() {
  const { user, profile, isLoading: authLoading } = useSupabaseAuth();
  const { entries, migrateFromLocalStorage, isLoading: logLoading } = useSupabaseLog();
  const { permissions, isLoading: rbacLoading } = useSupabaseRbac();
  
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Check if there's data in localStorage
  const hasLocalData = typeof window !== 'undefined' && localStorage.getItem('captain-log-entries-v2');
  
  // Migration function
  const handleMigration = async () => {
    if (!user) return;
    
    try {
      setIsMigrating(true);
      await migrateFromLocalStorage();
      toast.success("Data migration completed successfully");
    } catch (error: any) {
      toast.error(error.message || "Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  // Calculate integration completion
  const getSetupStatus = () => {
    let steps = [
      { name: "Supabase Connection", completed: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
      { name: "Authentication", completed: !!user },
      { name: "Database Schema", completed: !!user && entries !== undefined },
      { name: "RBAC Permissions", completed: !!permissions.length },
      { name: "Data Migration", completed: !hasLocalData || entries.length > 0 },
    ];
    
    const completedSteps = steps.filter(step => step.completed).length;
    const percentage = (completedSteps / steps.length) * 100;
    
    return {
      steps,
      completedSteps,
      totalSteps: steps.length,
      percentage
    };
  };
  
  const setupStatus = getSetupStatus();
  
  return (
    <div className="container py-10">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Supabase Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your Supabase integration and data
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/">
                <CalendarIcon className="h-4 w-4 mr-2" />
                Back to App
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profile">
                <UserIcon className="h-4 w-4 mr-2" />
                Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-7">
        <div className="md:col-span-5">
          <SupabaseSandbox />
        </div>

        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>Setup progress and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Setup progress</span>
                  <span className="font-medium">{setupStatus.completedSteps}/{setupStatus.totalSteps}</span>
                </div>
                <Progress value={setupStatus.percentage} className="h-2" />
              </div>

              <div className="space-y-4">
                {setupStatus.steps.map((step, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${step.completed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                        {step.completed ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <ClockIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span>{step.name}</span>
                    </div>
                    <Badge variant={step.completed ? 'outline' : 'secondary'}>
                      {step.completed ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Transfer and manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Data Statistics</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Entries</div>
                    <div className="text-2xl font-bold">
                      {logLoading ? "..." : entries.length}
                    </div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Permissions</div>
                    <div className="text-2xl font-bold">
                      {rbacLoading ? "..." : permissions.length}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-medium">Data Migration</h3>
                {hasLocalData ? (
                  <div className="p-3 bg-amber-50 text-amber-700 rounded-md">
                    <p className="text-sm">
                      You have local data that can be migrated to Supabase
                    </p>
                    <Button 
                      size="sm" 
                      className="mt-2" 
                      onClick={handleMigration}
                      disabled={!user || isMigrating}
                    >
                      {isMigrating ? "Migrating..." : "Migrate Data"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 text-green-700 rounded-md">
                    <p className="text-sm">
                      No local data detected or migration already complete
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/supabase-test">
                  <DatabaseIcon className="h-4 w-4 mr-2" />
                  Test Connection
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>Learn more about Supabase</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link 
                    href="/SUPABASE_SETUP.md"
                    target="_blank"
                    className="text-primary hover:underline flex justify-between items-center"
                  >
                    <span>Setup Documentation</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://supabase.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex justify-between items-center"
                  >
                    <span>Supabase Documentation</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>
                </li>
                <li>
                  <a 
                    href="https://github.com/supabase/supabase"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex justify-between items-center"
                  >
                    <span>Supabase GitHub</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
