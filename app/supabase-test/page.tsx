"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { testSupabaseConnection, createSampleData } from "@/lib/test-supabase";

type TestResult = {
  name: string;
  status: "success" | "error" | "pending";
  message: string;
  details?: any;
};

export default function SupabaseTestPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Run the connection test automatically
  useEffect(() => {
    const runConnectionTest = async () => {
      const connectionResult = await testSupabaseConnection();
      
      setResults([{
        name: "Connection Test",
        status: connectionResult.success ? "success" : "error",
        message: connectionResult.message,
        details: connectionResult.data || connectionResult.error
      }]);
    };
    
    if (!authLoading) {
      runConnectionTest();
    }
  }, [authLoading]);
  
  // Run all tests
  const runAllTests = async () => {
    if (!user) return;
    
    setIsRunning(true);
    
    try {
      // Connection test
      const connectionResult = await testSupabaseConnection();
      
      setResults([{
        name: "Connection Test",
        status: connectionResult.success ? "success" : "error",
        message: connectionResult.message,
        details: connectionResult.data || connectionResult.error
      }]);
      
      if (!connectionResult.success) {
        setIsRunning(false);
        return;
      }
      
      // Create sample data
      setResults(prev => [...prev, {
        name: "Sample Data Test",
        status: "pending",
        message: "Creating sample data..."
      }]);
      
      const sampleDataResult = await createSampleData(user.id);
      
      setResults(prev => prev.map(r => 
        r.name === "Sample Data Test" ? {
          name: "Sample Data Test",
          status: sampleDataResult.success ? "success" : "error",
          message: sampleDataResult.message,
          details: sampleDataResult.entries || sampleDataResult.error
        } : r
      ));
      
    } catch (error: any) {
      console.error("Test error:", error);
      setResults(prev => [...prev, {
        name: "Unexpected Error",
        status: "error",
        message: error.message || "An unexpected error occurred",
        details: error
      }]);
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Supabase Integration Test</h1>
            <p className="text-muted-foreground">
              Verify your Supabase configuration and connection
            </p>
          </div>
          <div>
            <Button variant="outline" asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
          <CardDescription>
            Current environment and configuration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm">Supabase URL</h3>
                <p className="text-sm text-muted-foreground break-all">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? 
                    process.env.NEXT_PUBLIC_SUPABASE_URL : 
                    <Badge variant="destructive">Missing</Badge>
                  }
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm">Supabase Anon Key</h3>
                <p className="text-sm text-muted-foreground">
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
                    <Badge variant="outline">Configured</Badge> : 
                    <Badge variant="destructive">Missing</Badge>
                  }
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium text-sm">Authentication Status</h3>
              <div className="mt-1">
                {authLoading ? (
                  <Badge variant="outline">Checking...</Badge>
                ) : user ? (
                  <div className="space-y-1">
                    <Badge variant="success">Authenticated</Badge>
                    <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Badge variant="destructive">Not authenticated</Badge>
                    <p className="text-sm text-muted-foreground">
                      <Link href="/login" className="text-primary hover:underline">
                        Log in
                      </Link> to run all tests
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={runAllTests} 
            disabled={isRunning || !user}
          >
            {isRunning ? "Running Tests..." : "Run All Tests"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>
            Results from connection and functionality tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              No tests have been run yet
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{result.name}</h3>
                    {result.status === "success" && (
                      <Badge variant="success">Success</Badge>
                    )}
                    {result.status === "error" && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                    {result.status === "pending" && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1">{result.message}</p>
                  {result.details && (
                    <pre className="mt-2 p-2 bg-muted text-xs overflow-x-auto rounded">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
