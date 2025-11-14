"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  DatabaseIcon, 
  UserIcon, 
  LogOutIcon, 
  SettingsIcon, 
  ChevronDownIcon, 
  LockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon
} from "lucide-react";

export function SupabaseNav() {
  const pathname = usePathname();
  const { user, profile, logout, isLoading } = useSupabaseAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <DatabaseIcon className="h-4 w-4 mr-2" />
        <span className="hidden md:inline">Loading...</span>
      </Button>
    );
  }
  
  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <UserIcon className="h-4 w-4 mr-2" />
              <span className="hidden md:inline mr-1">{profile?.name || user.email}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon className="h-4 w-4 mr-2" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/supabase-dashboard">
                  <DatabaseIcon className="h-4 w-4 mr-2" />
                  <span>Supabase Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/supabase-test">
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  <span>Test Connection</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon className="h-4 w-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <InfoIcon className="h-4 w-4 mr-2" />
                <span>Supabase Status</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Supabase Integration</DialogTitle>
                <DialogDescription>
                  Configure Supabase to enable cloud storage and authentication
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-start gap-4">
                  {isSupabaseConfigured ? (
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircleIcon className="h-6 w-6 text-amber-600" />
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <h4 className="font-medium">Supabase Configuration</h4>
                    {isSupabaseConfigured ? (
                      <p className="text-sm text-muted-foreground">
                        Supabase is configured correctly. You can now log in to use cloud features.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Supabase is not configured. Please set up your environment variables.
                      </p>
                    )}
                    <div className="pt-2">
                      <Link href="/SUPABASE_SETUP.md" className="text-sm text-primary hover:underline">
                        View setup instructions
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Close
                    </Button>
                    {isSupabaseConfigured && (
                      <Button asChild>
                        <Link href="/login">
                          Login
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button size="sm" asChild>
            <Link href="/login">
              <LockIcon className="h-4 w-4 mr-2" />
              <span>Login</span>
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
