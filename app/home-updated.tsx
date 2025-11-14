"use client";

import { useState, useEffect } from "react";
import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { AuthProvider } from "@/contexts/auth-context";
import { MainLayout } from "@/components/main-layout";
import { MainLayoutUpdated } from "@/components/main-layout-updated";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, HardDrive, Cloud, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function HomeUpdated() {
  const [isClient, setIsClient] = useState(false);
  const [storageMode, setStorageMode] = useState<"local" | "supabase">("local");
  const [supabseConfigured, setSupabaseConfigured] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check if Supabase is configured
    setSupabaseConfigured(!!process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Check if user previously selected a storage mode
    const savedMode = localStorage.getItem("captain-log-storage-mode");
    if (savedMode === "supabase" || savedMode === "local") {
      setStorageMode(savedMode);
    }
  }, []);

  // Update local storage when mode changes
  const handleModeChange = (mode: "local" | "supabase") => {
    setStorageMode(mode);
    localStorage.setItem("captain-log-storage-mode", mode);
  };

  if (!isClient) {
    return null;
  }

  // If Supabase is configured and the mode is supabase, show the Supabase version
  if (storageMode === "supabase" && supabseConfigured) {
    return (
      <SupabaseVersion />
    );
  }

  // Otherwise show the LocalStorage version or the mode selector
  return (
    <>
      <LocalStorageVersion showModeSelector={supabseConfigured} onModeChange={handleModeChange} currentMode={storageMode} />
    </>
  );
}

// Supabase Version - Cloud Storage
function SupabaseVersion() {
  // Dynamically import to ensure it only loads when needed
  const SupabaseProviders = dynamic(() => import("@/components/supabase-providers"), { ssr: false });
  const MainLayoutUpdated = dynamic(() => import("@/components/main-layout-updated"), { ssr: false });
  
  return (
    <SupabaseProviders>
      <MainLayoutUpdated />
    </SupabaseProviders>
  );
}

// Local Storage Version - Traditional Approach
function LocalStorageVersion({ showModeSelector, onModeChange, currentMode }: { 
  showModeSelector: boolean;
  onModeChange: (mode: "local" | "supabase") => void;
  currentMode: "local" | "supabase";
}) {
  if (!showModeSelector) {
    // If Supabase is not configured, just show the traditional version
    return (
      <AuthProvider>
        <CaptainLogProvider>
          <MainLayout />
        </CaptainLogProvider>
      </AuthProvider>
    );
  }

  // If Supabase is configured, show the storage selector
  return (
    <AuthProvider>
      <CaptainLogProvider>
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="w-80 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage Mode
              </CardTitle>
              <CardDescription>Choose where to store your data</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={currentMode} onValueChange={(v) => onModeChange(v as "local" | "supabase")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="local" className="flex items-center gap-1">
                    <HardDrive className="h-4 w-4" />
                    Local
                  </TabsTrigger>
                  <TabsTrigger value="supabase" className="flex items-center gap-1">
                    <Cloud className="h-4 w-4" />
                    Cloud
                  </TabsTrigger>
                </TabsList>
                <div className="mt-4">
                  {currentMode === "local" ? (
                    <Alert>
                      <HardDrive className="h-4 w-4" />
                      <AlertTitle>Using Local Storage</AlertTitle>
                      <AlertDescription>
                        Data is stored in your browser only.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <Cloud className="h-4 w-4" />
                      <AlertTitle>Using Cloud Storage</AlertTitle>
                      <AlertDescription>
                        Click Apply to switch to Supabase cloud storage.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between pt-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Just close this selector
                  const element = document.getElementById("storage-selector");
                  if (element) {
                    element.style.display = "none";
                  }
                }}
              >
                Dismiss
              </Button>
              {currentMode === "supabase" && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Apply
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        <MainLayout />
      </CaptainLogProvider>
    </AuthProvider>
  );
}

// Fix TypeScript error with dynamic imports
import dynamic from 'next/dynamic';
