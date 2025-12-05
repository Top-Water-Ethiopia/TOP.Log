"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { useRBAC } from "@/hooks/use-rbac";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Menu,
  Home,
  Calendar,
  BarChart3,
  FileText,
  Shield,
  User,
  LogOut,
  Settings,
  LayoutDashboard
} from "lucide-react";

// Role IDs from schema
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';

export function MobileNavigation() {
  const pathname = usePathname();
  const { user, profile, logout } = useSupabaseAuth();
  const { canAccessAdmin, canViewAnalytics } = useRBAC();
  const [isOpen, setIsOpen] = useState(false);

  // Check if current user is super admin
  const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID;

  // Handle logout
  const handleLogout = async () => {
    try {
      setIsOpen(false);
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Navigation items
  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: Home,
      active: pathname === "/",
    },
    {
      name: "Calendar",
      href: "/calendar",
      icon: Calendar,
      active: pathname.startsWith("/calendar"),
    },
  ];

  // Admin items
  const adminItems = [
    {
      name: "Admin Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      active: pathname.startsWith("/admin"),
    },
    {
      name: "Reports",
      href: "/admin/reports",
      icon: FileText,
      active: pathname.startsWith("/admin/reports"),
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">TOP Captain's Log</h2>
            {user ? (
              <p className="text-sm text-muted-foreground truncate">
                {profile?.name || user.email}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Guest</p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-1 px-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    item.active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Admin Section - Only shown when user is logged in */}
            {user && (isSuperAdmin || canAccessAdmin) && (
              <div className="px-2 pt-4">
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </h3>
                <div className="space-y-1 pt-2">
                  {adminItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Analytics Section - Only shown when user is logged in */}
            {user && canViewAnalytics && (
              <div className="px-2 pt-4">
                <Link
                  href="/analytics"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    pathname.startsWith("/analytics")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="space-y-2">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}