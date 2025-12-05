"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { CaptainLogProvider } from "@/contexts/captain-log-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { MobileNavigation } from "@/components/mobile-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CaptainLogProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AdminSidebar />
            {/* Mobile Navigation for Admin Pages - Fixed position */}
            <div className="lg:hidden fixed top-4 right-4 z-50">
              <MobileNavigation />
            </div>
            <SidebarInset className="flex-1 overflow-auto">
              {children}
            </SidebarInset>
          </div>
        </SidebarProvider>
      </CaptainLogProvider>
    </AuthProvider>
  );
}