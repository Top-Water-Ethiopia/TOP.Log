"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useCaptainLog } from "@/contexts/captain-log-context"
import { ArrowLeft, Save } from "lucide-react"

interface EntryFormProps {
  date: string
  onSave: () => void
  onCancel: () => void
}

export function EntryForm({ date, onSave, onCancel }: EntryFormProps) {
  const { getEntryByDate, addEntry, updateEntry } = useCaptainLog()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    developmentTasks: "",
    featuresCompleted: "",
    challengesAndBlockers: "",
    codeAndPriorities: "",
    systemImprovements: "",
    projectUpdates: "",
  })

  // Load existing entry if it exists
  useEffect(() => {
    const existingEntry = getEntryByDate(date)
    if (existingEntry) {
      setFormData({
        developmentTasks: existingEntry.developmentTasks || "",
        featuresCompleted: existingEntry.featuresCompleted || "",
        challengesAndBlockers: existingEntry.challengesAndBlockers || "",
        codeAndPriorities: existingEntry.codeAndPriorities || "",
        systemImprovements: existingEntry.systemImprovements || "",
        projectUpdates: existingEntry.projectUpdates || "",
      })
    }
  }, [date, getEntryByDate])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const existingEntry = getEntryByDate(date)

      if (existingEntry) {
        // Update existing entry
        updateEntry(existingEntry.id, {
          ...formData,
          date,
        })
      } else {
        // Create new entry
        addEntry({
          date,
          ...formData,
        })
      }

      onSave()
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00")
    return date.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  const fields = [
    {
      id: "developmentTasks",
      label: "Development Tasks",
      placeholder: "What development tasks did you work on today?",
      description: "List all active development tasks and their current status",
    },
    {
      id: "featuresCompleted",
      label: "Features Completed",
      placeholder: "Which features or tickets did you complete?",
      description: "Document any completed features, bug fixes, or merged pull requests",
    },
    {
      id: "challengesAndBlockers",
      label: "Challenges & Blockers",
      placeholder: "What challenges or blockers did you encounter?",
      description: "Note any issues, dependencies, or blockers that are impacting progress",
    },
    {
      id: "codeAndPriorities",
      label: "Code Review & Priorities",
      placeholder: "What code reviews did you perform? What are your priorities?",
      description: "Summarize code review activities and set priorities for tomorrow",
    },
    {
      id: "systemImprovements",
      label: "System Improvements",
      placeholder: "What improvements or optimizations did you make?",
      description: "Document infrastructure improvements, refactoring, or performance enhancements",
    },
    {
      id: "projectUpdates",
      label: "Project Updates",
      placeholder: "Any important project updates or announcements?",
      description: "Record significant project changes, milestones, or team updates",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Log Entry</h2>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(date)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-2 bg-transparent">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <label htmlFor={field.id} className="block text-sm font-medium text-foreground">
              {field.label}
            </label>
            <p className="text-xs text-muted-foreground">{field.description}</p>
            <textarea
              id={field.id}
              value={formData[field.id as keyof typeof formData]}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 min-h-24 resize-none"
            />
          </div>
        ))}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-6 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Discard
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </form>
    </div>
  )
}
