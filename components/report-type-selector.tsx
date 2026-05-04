"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, FileText, Loader2 } from "lucide-react"
import { getEntryKindLabel } from "@/lib/entry-kinds"

export type ReportType = string | null

interface ReportTypeSelectorProps {
  departmentId: string
  role?: string | null
  onSelect: (type: ReportType) => void
  onCancel?: () => void
  isLoading?: boolean
}

export function ReportTypeSelector({ 
  departmentId, 
  role, 
  onSelect, 
  onCancel, 
  isLoading = false 
}: ReportTypeSelectorProps) {
  const [availableTypes, setAvailableTypes] = useState<ReportType[]>([])
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAvailableTypes = async () => {
      try {
        setIsChecking(true)
        setError(null)

        // Construct URLs for both scopes if role is present
        const deptUrl = `/api/role-questions?forReport=true&departmentId=${encodeURIComponent(departmentId)}`
        const roleUrl = role ? `${deptUrl}&role=${encodeURIComponent(role)}` : null

        const fetchPromises = [fetch(deptUrl, { credentials: "include" })]
        if (roleUrl) {
          fetchPromises.push(fetch(roleUrl, { credentials: "include" }))
        }

        const responses = await Promise.all(fetchPromises)
        const entryKinds = new Set<string>()

        for (const response of responses) {
          if (!response.ok) {
            throw new Error("Failed to check available report types")
          }
          const questions = await response.json()
          if (Array.isArray(questions)) {
            questions.forEach((q) => {
              if (q.entry_kind) {
                entryKinds.add(q.entry_kind)
              }
            })
          }
        }

        // Determine available types based on questions found
        const types: ReportType[] = Array.from(entryKinds).sort()
        
        // If no types found, we still return empty to let the UI handle the "No questions" state
        setAvailableTypes(types)

        // Auto-select if only one type available
        if (types.length === 1) {
          onSelect(types[0])
        }
      } catch (err) {
        console.error("Error checking report types:", err)
        setError(err instanceof Error ? err.message : "Failed to check available report types")
      } finally {
        setIsChecking(false)
      }
    }

    checkAvailableTypes()
  }, [departmentId, role, onSelect])

  if (isChecking || isLoading) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Checking available report types...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || availableTypes.length === 0) {
    return (
      <Card className="mx-auto w-full max-w-2xl border-red-100 bg-red-50/30">
        <CardContent className="py-8">
          <div className="text-center">
            <h3 className="mb-2 font-semibold text-red-900">Unable to Proceed</h3>
            <p className="mb-6 text-red-700">
              {error || "No report questions are currently configured for your role in this department."}
            </p>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="border-red-200 hover:bg-red-100">
                Go Back
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // If only one type, don't show selector (already auto-selected)
  if (availableTypes.length <= 1) {
    return null
  }

  return (
    <Card className="mx-auto w-full max-w-2xl shadow-lg transition-all">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-gray-900">Select Report Type</CardTitle>
        <CardDescription className="text-base text-gray-600">
          Multiple report types are available. Choose one to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {availableTypes.map((type) => {
            const isStandard = type === "standard" || !type
            const label = getEntryKindLabel(type || "standard")
            
            return (
              <button
                key={type || "standard"}
                onClick={() => onSelect(type)}
                className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-gray-100 bg-white p-8 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md"
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors group-hover:bg-blue-200 ${
                  isStandard ? "bg-blue-100" : "bg-purple-100"
                }`}>
                  {isStandard ? (
                    <FileText className={`h-8 w-8 ${isStandard ? "text-blue-600" : "text-purple-600"}`} />
                  ) : (
                    <Users className="h-8 w-8 text-purple-600" />
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-900">{label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Open the {label.toLowerCase()} form to record your entries.
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {onCancel && (
          <div className="mt-8 flex justify-center border-t pt-6">
            <Button variant="ghost" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
              Cancel and Return
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
