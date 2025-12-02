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
    // Type assertion for extended validation properties
    const validation = question.validation as any
    
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

      case "email":
        return (
          <Input
            type="email"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "youremail@topwaterethiopia.com"}
            className={error ? "border-destructive" : ""}
          />
        )

      case "url":
        return (
          <Input
            type="url"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "https://topwaterethiopia.com"}
            className={error ? "border-destructive" : ""}
          />
        )

      case "phone":
        return (
          <Input
            type="tel"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "+251 901-234-567"}
            className={error ? "border-destructive" : ""}
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
            step={question.validation?.step}
            className={error ? "border-destructive" : ""}
          />
        )

      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0.00"}
              min={question.validation?.min ?? 0}
              max={question.validation?.max}
              step={question.validation?.step ?? "0.01"}
              className={`pl-7 ${error ? "border-destructive" : ""}`}
            />
          </div>
        )

      case "percentage":
        return (
          <div className="relative">
            <Input
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0"}
              min={question.validation?.min ?? 0}
              max={question.validation?.max ?? 100}
              step={question.validation?.step ?? 1}
              className={`pr-7 ${error ? "border-destructive" : ""}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
        )

      case "date":
        return (
          <Input
            type="date"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={question.validation?.min_date}
            max={question.validation?.max_date}
            className={error ? "border-destructive" : ""}
          />
        )

      case "time":
        return (
          <Input
            type="time"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            className={error ? "border-destructive" : ""}
          />
        )

      case "datetime":
        return (
          <Input
            type="datetime-local"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={question.validation?.min_date}
            max={question.validation?.max_date}
            className={error ? "border-destructive" : ""}
          />
        )

      case "daterange":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={value?.start ?? ""}
                onChange={(event) => onChange(question.key, { ...value, start: event.target.value })}
                min={question.validation?.min_date}
                max={value?.end || question.validation?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={value?.end ?? ""}
                onChange={(event) => onChange(question.key, { ...value, end: event.target.value })}
                min={value?.start || question.validation?.min_date}
                max={question.validation?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
          </div>
        )

      case "duration":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hours</Label>
              <Input
                type="number"
                value={value?.hours ?? ""}
                onChange={(event) => onChange(question.key, { ...value, hours: event.target.value })}
                placeholder="0"
                min="0"
                className={error ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Minutes</Label>
              <Input
                type="number"
                value={value?.minutes ?? ""}
                onChange={(event) => onChange(question.key, { ...value, minutes: event.target.value })}
                placeholder="0"
                min="0"
                max="59"
                className={error ? "border-destructive" : ""}
              />
            </div>
          </div>
        )

      case "select":
      case "priority":
      case "status":
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

      case "radio":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${question.key}-${option}`}
                  name={question.key}
                  value={option}
                  checked={value === option}
                  onChange={(event) => onChange(question.key, event.target.value)}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                />
                <Label htmlFor={`${question.key}-${option}`} className="text-sm font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        )

      case "multiselect":
      case "tags":
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
                  <Label htmlFor={checkboxId} className="text-sm font-normal cursor-pointer">
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
            <Label htmlFor={question.key} className="text-sm font-normal cursor-pointer">
              {question.placeholder || "Check this option"}
            </Label>
          </div>
        )

      case "rating":
        return (
          <Select
            value={value ?? ""}
            onValueChange={(newValue) => onChange(question.key, newValue)}
          >
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder="Select rating" />
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

      case "slider":
        return (
          <div className="space-y-4">
            <input
              type="range"
              value={value ?? question.validation?.min ?? 0}
              onChange={(event) => onChange(question.key, event.target.value)}
              min={question.validation?.min ?? 0}
              max={question.validation?.max ?? 100}
              step={question.validation?.step ?? 1}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {question.validation?.min ?? 0}
              </span>
              <span className="text-lg font-semibold text-primary">
                {value ?? question.validation?.min ?? 0}
              </span>
              <span className="text-sm text-muted-foreground">
                {question.validation?.max ?? 100}
              </span>
            </div>
          </div>
        )

      case "nps":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-11 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => onChange(question.key, score)}
                  className={`h-12 rounded-md border-2 font-semibold transition-all ${
                    value === score
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-gray-300 hover:border-primary/50 hover:bg-primary/10"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )

      case "file":
      case "image":
        return (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onChange(question.key, file.name)
                }
              }}
              accept={question.type === "image" ? "image/*" : undefined}
              className={error ? "border-destructive" : ""}
            />
            {value && (
              <p className="text-sm text-muted-foreground">Selected: {value}</p>
            )}
          </div>
        )

      case "rich-text":
        return (
          <Textarea
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "Enter formatted text..."}
            className={error ? "border-destructive" : ""}
            rows={6}
          />
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
          <Card
            key={question.key || (question as any).id}
            className="border-0 shadow-none bg-transparent p-0"
          >
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

