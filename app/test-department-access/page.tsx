"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DepartmentAccessLevelManager } from "@/components/department-access-level-manager"

export default function TestDepartmentAccessPage() {
  const [userId, setUserId] = useState("")
  const [departmentId, setDepartmentId] = useState("")

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Department Access Level Test</h1>
        <p className="text-muted-foreground">
          Test the new department access level system by entering a user ID and department ID.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Enter a user ID and department ID to test the department access level manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department ID</Label>
              <Input
                id="departmentId"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                placeholder="Enter department ID"
              />
            </div>
          </div>

          <div className="text-muted-foreground text-sm">
            <p>
              <strong>Note:</strong> You can find user IDs and department IDs in the admin panel or database.
            </p>
            <p>Example user IDs look like: "00000000-0000-0000-0000-000000000123"</p>
            <p>Example department IDs look like: "00000000-0000-0000-0000-000000000456"</p>
          </div>
        </CardContent>
      </Card>

      {userId && departmentId && <DepartmentAccessLevelManager userId={userId} departmentId={departmentId} />}

      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>Find a user ID from the admin users page or database</li>
            <li>Find a department ID from the admin departments page or database</li>
            <li>Enter both IDs above</li>
            <li>The Department Access Level Manager should appear below</li>
            <li>Test assigning different access levels to the user</li>
            <li>Verify permissions are displayed correctly</li>
          </ol>

          <div className="bg-muted rounded-lg p-4">
            <h4 className="mb-2 font-medium">Expected Behavior:</h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Shows current access level assignment (if any)</li>
              <li>Lists all available access levels (viewer → department-lead)</li>
              <li>Displays permissions for the current access level</li>
              <li>Allows assigning/removing access levels</li>
              <li>Shows success/error messages for operations</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
