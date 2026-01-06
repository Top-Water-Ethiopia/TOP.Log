"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AuthProvider } from "@/contexts/auth-context";
import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CaptainLogProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AdminSidebar />
            <SidebarInset className="flex-1 overflow-auto">
              <header className="sticky top-0 z-10 border-b bg-background">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <span className="text-sm font-medium">Navigation</span>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/">Back to Home</Link>
                  </Button>
                </div>
              </header>
              <div className="py-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  {children}
                </div>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </CaptainLogProvider>
    </AuthProvider>
  );
}

