"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRBAC } from "@/hooks/use-rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  GripVertical,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import type { CustomQuestion, RoleQuestionSet, QuestionResponse } from "@/lib/rbac/types"
import { 
  getAllQuestionSets, 
  saveQuestionSet, 
  validateQuestionResponse, 
  processQuestionResponses 
} from "@/lib/rbac/utils"
import { toast } from "sonner"

interface CustomQuestionFormProps {
  question?: CustomQuestion
  onSave: (question: CustomQuestion) => void
  onCancel: () => void
}

function CustomQuestionForm({ question, onSave, onCancel }: CustomQuestionFormProps) {
  const [formData, setFormData] = useState<CustomQuestion>(
    question || {
      id: "",
      key: "",
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      options: [],
      validation: {},
      defaultValue: "",
      description: "",
      category: "General",
      order: 0,
    }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.label.trim()) {
      newErrors.label = "Label is required"
    }
    if (!formData.key.trim()) {
      newErrors.key = "Key is required"
    }
    if (formData.key && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.key)) {
      newErrors.key = "Key must start with a letter and contain only letters, numbers, and underscores"
    }
    if ((formData.type === "select" || formData.type === "multiselect") && (!formData.options || formData.options.length === 0)) {
      newErrors.options = "Options are required for select/multiselect types"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) return

    const questionToSave: CustomQuestion = {
      ...formData,
      id: question?.id || `q_${Date.now()}`,
      key: formData.key.toLowerCase().replace(/\s+/g, '_'),
    }

    onSave(questionToSave)
  }

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...(prev.options || []), ""]
    }))
  }

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt) || []
    }))
  }

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || []
    }))
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {question ? "Edit Question" : "Add New Question"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="label">Question Label *</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            placeholder="Enter question label"
          />
          {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="key">Field Key *</Label>
          <Input
            id="key"
            value={formData.key}
            onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
            placeholder="field_key"
          />
          {errors.key && <p className="text-sm text-destructive">{errors.key}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Question Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="textarea">Textarea</SelectItem>
              <SelectItem value="select">Select Dropdown</SelectItem>
              <SelectItem value="multiselect">Multi-select</SelectItem>
              <SelectItem value="checkbox">Checkbox</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="General"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description for the question"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="placeholder">Placeholder</Label>
        <Input
          id="placeholder"
          value={formData.placeholder}
          onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
          placeholder="Enter placeholder text"
        />
      </div>

      {(formData.type === "select" || formData.type === "multiselect") && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {formData.options?.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => removeOption(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addOption} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </div>
          {errors.options && <p className="text-sm text-destructive">{errors.options}</p>}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="required"
          checked={formData.required}
          onCheckedChange={(checked) => 
            setFormData(prev => ({ ...prev, required: !!checked }))
          }
        />
        <Label htmlFor="required">Required field</Label>
      </div>

      {formData.type === "number" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min">Minimum Value</Label>
            <Input
              id="min"
              type="number"
              value={formData.validation?.min || ""}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                validation: { ...prev.validation, min: Number(e.target.value) || undefined }
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Maximum Value</Label>
            <Input
              id="max"
              type="number"
              value={formData.validation?.max || ""}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                validation: { ...prev.validation, max: Number(e.target.value) || undefined }
              }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface RoleQuestionSetEditorProps {
  roleQuestionSet: RoleQuestionSet
  onSave: (set: RoleQuestionSet) => void
  onCancel: () => void
}

function RoleQuestionSetEditor({ roleQuestionSet, onSave, onCancel }: RoleQuestionSetEditorProps) {
  const [questions, setQuestions] = useState<CustomQuestion[]>(roleQuestionSet.questions)
  const [editingQuestion, setEditingQuestion] = useState<CustomQuestion | null>(null)
  const [isAddingQuestion, setIsAddingQuestion] = useState(false)

  const handleSaveQuestion = (question: CustomQuestion) => {
    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === question.id ? question : q))
    } else {
      setQuestions(prev => [...prev, { ...question, order: prev.length }])
    }
    setEditingQuestion(null)
    setIsAddingQuestion(false)
  }

  const handleEditQuestion = (question: CustomQuestion) => {
    setEditingQuestion(question)
    setIsAddingQuestion(false)
  }

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId))
  }

  const handleSaveSet = () => {
    const updatedSet: RoleQuestionSet = {
      ...roleQuestionSet,
      questions: questions.sort((a, b) => a.order - b.order),
      updatedAt: new Date().toISOString(),
      version: roleQuestionSet.version + 1,
    }
    onSave(updatedSet)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Questions for {roleQuestionSet.roleName} role
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSaveSet}>
            <Save className="h-4 w-4 mr-2" />
            Save Question Set
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <Card key={question.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm">{question.label}</CardTitle>
                    <CardDescription className="text-xs">
                      Key: {question.key} • Type: {question.type} • Category: {question.category}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {question.required && <Badge variant="destructive">Required</Badge>}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditQuestion(question)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteQuestion(question.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {question.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{question.description}</p>
              </CardContent>
            )}
          </Card>
        ))}

        {isAddingQuestion && (
          <CustomQuestionForm
            onSave={handleSaveQuestion}
            onCancel={() => setIsAddingQuestion(false)}
          />
        )}

        {editingQuestion && (
          <CustomQuestionForm
            question={editingQuestion}
            onSave={handleSaveQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        )}

        {!isAddingQuestion && !editingQuestion && (
          <Button 
            variant="dashed" 
            className="w-full" 
            onClick={() => setIsAddingQuestion(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        )}
      </div>
    </div>
  )
}

export function CustomQuestionsManager() {
  const { user } = useAuth()
  const { canManageUsers } = useRBAC()
  const [questionSets, setQuestionSets] = useState<RoleQuestionSet[]>([])
  const [editingSet, setEditingSet] = useState<RoleQuestionSet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadQuestionSets = () => {
      try {
        const sets = getAllQuestionSets()
        setQuestionSets(sets)
      } catch (error) {
        toast.error("Failed to load question sets")
      } finally {
        setLoading(false)
      }
    }

    loadQuestionSets()
  }, [])

  const handleSaveSet = (set: RoleQuestionSet) => {
    try {
      saveQuestionSet(set)
      setQuestionSets(prev => prev.map(s => s.roleId === set.roleId ? set : s))
      setEditingSet(null)
      toast.success("Question set saved successfully")
    } catch (error) {
      toast.error("Failed to save question set")
    }
  }

  if (!canManageUsers) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to manage custom questions. This feature requires user management permissions.
        </AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return <div className="p-8 text-center">Loading custom questions...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Custom Questions Manager</h2>
        <p className="text-muted-foreground">
          Configure role-specific questions for log entries
        </p>
      </div>

      {editingSet ? (
        <RoleQuestionSetEditor
          roleQuestionSet={editingSet}
          onSave={handleSaveSet}
          onCancel={() => setEditingSet(null)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {questionSets.map((set) => (
            <Card key={set.roleId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="capitalize">{set.roleName} Questions</CardTitle>
                    <CardDescription>
                      {set.questions.length} question{set.questions.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={set.isActive ? "default" : "secondary"}>
                      {set.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditingSet(set)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {set.questions.slice(0, 3).map((question) => (
                    <div key={question.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{question.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {question.type}
                      </Badge>
                    </div>
                  ))}
                  {set.questions.length > 3 && (
                    <p className="text-sm text-muted-foreground">
                      ...and {set.questions.length - 3} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
