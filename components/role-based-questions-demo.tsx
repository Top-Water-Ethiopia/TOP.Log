"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, Save, Eye, AlertCircle, Settings, Shield } from "lucide-react"
import { toast } from "sonner"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"

export function RoleBasedQuestionsDemo() {
  const { user } = useAuth()
  const { questions, validateResponse, processResponses } = useRBAC()
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPreview, setIsPreview] = useState(false)

  // Initialize default responses based on questions
  useEffect(() => {
    const defaultResponses: Record<string, any> = {}
    questions.forEach(question => {
      if (question.defaultValue !== undefined) {
        defaultResponses[question.key] = question.defaultValue
      } else if (question.type === "multiselect") {
        defaultResponses[question.key] = []
      } else if (question.type === "checkbox") {
        defaultResponses[question.key] = false
      } else {
        defaultResponses[question.key] = ""
      }
    })
    setResponses(defaultResponses)
  }, [questions])

  const handleResponseChange = (questionKey: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionKey]: value }))
    
    // Clear error for this field when user starts typing
    if (errors[questionKey]) {
      setErrors(prev => ({ ...prev, [questionKey]: "" }))
    }
  }

  const validateAllResponses = () => {
    const newErrors: Record<string, string> = {}
    
    questions.forEach(question => {
      const error = validateResponse(question, responses[question.key])
      if (error) {
        newErrors[question.key] = error
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateAllResponses()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    const result = processResponses(questions, responses)
    if (result.valid) {
      // Here you would normally save the responses to your log entry
      toast.success("Log entry saved successfully!")
      setIsPreview(true)
    } else {
      setErrors(result.errors)
      toast.error("Please fix the validation errors")
    }
  }

  const renderPreview = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Preview of Your Log Entry</h3>
          <Button variant="outline" onClick={() => setIsPreview(false)}>
            <FileText className="h-4 w-4 mr-2" />
            Back to Edit
          </Button>
        </div>
        
        {questions.map((question) => {
          const value = responses[question.key]
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value || "Not provided")
          
          return (
            <Card key={question.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{question.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {displayValue}
                </p>
              </CardContent>
            </Card>
          )
        })}
        
        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Entry
          </Button>
          <Button variant="outline" onClick={() => setIsPreview(false)}>
            Continue Editing
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please log in to see role-based questions.
        </AlertDescription>
      </Alert>
    )
  }

  if (questions.length === 0) {
    return (
      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          No custom questions are configured for your role ({user.role}). 
          An administrator can set up role-specific questions in the admin dashboard.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Role-Based Questions Demo</h2>
          <p className="text-muted-foreground">
            Questions customized for your role: <Badge variant="outline" className="ml-2">{user.role}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {user.name}
          </Badge>
          <Badge variant="outline">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          This is a demonstration of role-based custom questions. Different user roles see different question sets based on their permissions and responsibilities.
        </AlertDescription>
      </Alert>

      {isPreview ? renderPreview() : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Please answer the following questions:</h3>
            <Button variant="outline" onClick={() => setIsPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
          
          <RoleBasedQuestionFields
            questions={questions}
            responses={responses}
            errors={errors}
            onChange={handleResponseChange}
          />
          
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save Entry
            </Button>
            <Button variant="outline" onClick={() => setIsPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
