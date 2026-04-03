"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { CustomQuestion } from "@/lib/rbac/types"
import { getQuestionReactKey } from "@/lib/role-question-identity"
import { cn } from "@/lib/utils"

interface RoleBasedQuestionFieldsProps {
  questions: (
    | CustomQuestion
    | {
        id?: string
        key: string
        label: string
        type: string
        description?: string
        placeholder?: string
        options?: any
        required: boolean
        order: number
        category?: string
        validationRules?: any
        validation?: any
        defaultValue?: any
      }
  )[]
  responses: Record<string, any>
  errors?: Record<string, string>
  onChange: (questionKey: string, value: any) => void
  renderMode?: "full" | "fieldsOnly"
}

export function RoleBasedQuestionFields({
  questions,
  responses,
  errors = {},
  onChange,
  renderMode = "full",
}: RoleBasedQuestionFieldsProps) {
  if (questions.length === 0) {
    return null
  }

  const renderField = (question: any, value: any, error?: string) => {
    const validationRules = (question?.validationRules || question?.validation || {}) as any

    const ariaInvalid = !!error
    const ariaDescribedBy = error ? `${question.key}-error` : undefined

    switch (question.type) {
      case "text":
        return (
          <Input
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "textarea":
        return (
          <Textarea
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn("min-h-[200px]", error ? "border-destructive" : "")}
            rows={4}
          />
        )

      case "email":
        return (
          <Input
            id={question.key}
            type="email"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "name@example.com"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "url":
        return (
          <Input
            id={question.key}
            type="url"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "https://example.com"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "phone":
        return (
          <Input
            id={question.key}
            type="tel"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "+251 901-234-567"}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "number":
        return (
          <div className="relative">
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={error ? "border-destructive" : ""}
            />
          </div>
        )

      case "currency":
        return (
          <div className="relative">
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">$</span>
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0.00"}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step ?? "0.01"}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={`pl-7 ${error ? "border-destructive" : ""}`}
            />
          </div>
        )

      case "percentage":
        return (
          <div className="relative">
            <Input
              id={question.key}
              type="number"
              value={value ?? ""}
              onChange={(event) => onChange(question.key, event.target.value)}
              placeholder={question.placeholder || "0"}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={`pr-7 ${error ? "border-destructive" : ""}`}
            />
            <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2">%</span>
          </div>
        )

      case "date":
        return (
          <Input
            id={question.key}
            type="date"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={validationRules?.min_date}
            max={validationRules?.max_date}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "time":
        return (
          <Input
            id={question.key}
            type="time"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "datetime":
        return (
          <Input
            id={question.key}
            type="datetime-local"
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            min={validationRules?.min_date}
            max={validationRules?.max_date}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )

      case "daterange":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Start Date</Label>
              <Input
                type="date"
                value={value?.start ?? ""}
                onChange={(event) => onChange(question.key, { ...value, start: event.target.value })}
                min={validationRules?.min_date}
                max={value?.end || validationRules?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">End Date</Label>
              <Input
                type="date"
                value={value?.end ?? ""}
                onChange={(event) => onChange(question.key, { ...value, end: event.target.value })}
                min={value?.start || validationRules?.min_date}
                max={validationRules?.max_date}
                className={error ? "border-destructive" : ""}
              />
            </div>
          </div>
        )

      case "duration":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Hours</Label>
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
              <Label className="text-muted-foreground text-xs">Minutes</Label>
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
          <Select value={value ?? ""} onValueChange={(newValue) => onChange(question.key, newValue)}>
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder={question.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option: string) => (
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
            {question.options?.map((option: string) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${question.key}-${option}`}
                  name={question.key}
                  value={option}
                  checked={value === option}
                  onChange={(event) => onChange(question.key, event.target.value)}
                  className="text-primary focus:ring-primary h-4 w-4 border-gray-300 focus:ring-2"
                />
                <Label htmlFor={`${question.key}-${option}`} className="cursor-pointer text-sm font-normal">
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
            {question.options?.map((option: string) => {
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
                        onChange(
                          question.key,
                          currentValues.filter((item: string) => item !== option)
                        )
                      }
                    }}
                  />
                  <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal">
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
            <Label htmlFor={question.key} className="cursor-pointer text-sm font-normal">
              {question.placeholder || "Check this option"}
            </Label>
          </div>
        )

      case "rating":
        return (
          <Select value={value ?? ""} onValueChange={(newValue) => onChange(question.key, newValue)}>
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option: string) => (
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
              value={value ?? validationRules?.min_value ?? validationRules?.min ?? 0}
              onChange={(event) => onChange(question.key, event.target.value)}
              min={validationRules?.min_value ?? validationRules?.min}
              max={validationRules?.max_value ?? validationRules?.max}
              step={validationRules?.step}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {validationRules?.min_value ?? validationRules?.min ?? ""}
              </span>
              <span className="text-primary text-lg font-semibold">
                {value ?? validationRules?.min_value ?? validationRules?.min ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">
                {validationRules?.max_value ?? validationRules?.max ?? ""}
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
                      : "hover:border-primary/50 hover:bg-primary/10 border-gray-300"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
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
              id={question.key}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onChange(question.key, file.name)
                }
              }}
              accept={question.type === "image" ? "image/*" : undefined}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={error ? "border-destructive" : ""}
            />
            {value && <p className="text-muted-foreground text-sm">Selected: {value}</p>}
          </div>
        )

      case "rich-text":
        return (
          <Textarea
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder || "Enter formatted text..."}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
            rows={6}
          />
        )

      default:
        return (
          <Input
            id={question.key}
            value={value ?? ""}
            onChange={(event) => onChange(question.key, event.target.value)}
            placeholder={question.placeholder}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={error ? "border-destructive" : ""}
          />
        )
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const reactKey = getQuestionReactKey(question, index)
        const value = responses[question.key]
        const error = errors[question.key]

        if (renderMode === "fieldsOnly") {
          return (
            <div key={reactKey} className="space-y-2">
              {renderField(question, value, error)}
              {error && (
                <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                  {error}
                </p>
              )}
            </div>
          )
        }

        return (
          <Card key={reactKey} className="border-0 bg-transparent p-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">{question.label}</CardTitle>
                    {question.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  {question.description && <CardDescription>{question.description}</CardDescription>}
                </div>
                {question.category && (
                  <Badge variant="secondary" className="text-xs">
                    {question.category}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderField(question, value, error)}
              {error && (
                <p id={`${question.key}-error`} className="text-destructive mt-2 text-sm">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
