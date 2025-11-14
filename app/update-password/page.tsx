"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { toast } from "sonner";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isResetValid, setIsResetValid] = useState(false);

  // Validate that the user has a valid reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        setIsResetValid(false);
        toast.error("Invalid or expired password reset link");
        return;
      }
      
      setIsResetValid(true);
    };
    
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset validation error
    setValidationError("");
    
    // Simple validation
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      toast.success("Password updated successfully");
      
      // Wait a moment before redirecting
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      
    } catch (error: any) {
      console.error("Update password error:", error);
      setValidationError(error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Update your password</CardTitle>
          <CardDescription>
            Create a new secure password for your account
          </CardDescription>
        </CardHeader>

        {!isResetValid ? (
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-50 text-amber-700 rounded-md">
              <h3 className="font-medium">Invalid or expired link</h3>
              <p className="text-sm mt-1">
                This password reset link is invalid or has expired. Please request a new password reset.
              </p>
            </div>
            <div className="text-center mt-4">
              <Link href="/reset-password" className="text-primary hover:underline">
                Request new password reset
              </Link>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              {validationError && (
                <div className="p-3 text-sm bg-red-50 text-red-500 rounded-md">
                  {validationError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Password"}
              </Button>

              <div className="text-center text-sm">
                <Link 
                  href="/login" 
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Back to login
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
