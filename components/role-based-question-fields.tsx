"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { CustomQuestion } from "@/lib/rbac/types"

interface RoleBasedQuestionFieldsProps {
  questions: (CustomQuestion | { key: string; label: string; type: string; description?: string; placeholder?: string; options?: any; required: boolean; order: number; validation?: any; defaultValue?: any })[]
  responses: Record<string, any>
  errors?: Record<string, string>
  onChange: (questionKey: string, value: any) => void
}

export function RoleBasedQuestionFields({
  questions,
  responses,
  errors = {},
  onChange,
}: RoleBasedQuestionFieldsProps) {
  if (questions.length === 0) {
    return null
  }

  const renderField = (question: CustomQuestion, value: any, error?: string) => {
    switch (question.type) {
      case "text":
        return (
          <Input
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            className={error ? "border-destructive" : ""}
          />
        )

      case "textarea":
        return (
          <Textarea
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            className={error ? "border-destructive" : ""}
            rows={4}
          />
        )

      case "number":
        return (
          <Input
            type="number"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            className={error ? "border-destructive" : ""}
          />
        )

      case "date":
        return (
          <Input
            type="date"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            className={error ? "border-destructive" : ""}
          />
        )

      case "select":
        return (
          <Select
            value={value ?? ""}
            onValueChange={(newValue) => onChange(question.key, newValue)}
          >
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder={question.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "multiselect":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => {
              const currentValues = Array.isArray(value) ? value : []
              const checkboxId = `${question.key}-${option}`

              return (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={checkboxId}
                    checked={currentValues.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange(question.key, [...currentValues, option])
                      } else {
                        onChange(question.key, currentValues.filter((item: string) => item !== option))
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="text-sm">
                    {option}
                  </Label>
                </div>
              )
            })}
          </div>
        )

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={question.key}
              checked={!!value}
              onCheckedChange={(checked) => onChange(question.key, !!checked)}
            />
            <Label htmlFor={question.key} className="text-sm">
              {question.placeholder || "Check this option"}
            </Label>
          </div>
        )

      default:
        return (
          <Input
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            className={error ? "border-destructive" : ""}
          />
        )
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => {
        const value = responses[question.key]
        const error = errors[question.key]

        return (
          <Card key={question.key || (question as any).id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">{question.label}</CardTitle>
                    {question.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">{question.type}</Badge>
                  </div>
                  {question.description && (
                    <CardDescription>{question.description}</CardDescription>
                  )}
                </div>
                {question.category && (
                  <Badge variant="secondary" className="text-xs">{question.category}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderField(question, value, error)}
              {error && (
                <p className="text-sm text-destructive mt-2">{error}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

