"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CaptainLogProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AdminSidebar />
            <SidebarInset className="flex-1 overflow-auto">
              {children}
            </SidebarInset>
          </div>
        </SidebarProvider>
      </CaptainLogProvider>
    </AuthProvider>
  );
}

