"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AuthProvider } from "@/contexts/auth-context";
import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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
              <div className="py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div className="mb-6 flex items-center justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/">Back to Home</Link>
                    </Button>
                  </div>
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

