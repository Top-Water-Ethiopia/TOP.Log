"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, Star } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export interface QuestionTemplate {
  id: string
  name: string
  description: string
  category: string
  question_type: string
  question_label: string
  question_description?: string
  placeholder?: string
  options?: string[]
  is_required: boolean
  help_text?: string
  validation?: {
    min_length?: number
    max_length?: number
    pattern?: string
    min_value?: number
    max_value?: number
  }
}

const QUESTION_TEMPLATES: QuestionTemplate[] = [
  // Common Questions
  {
    id: "template-1",
    name: "Project Name",
    description: "Standard project name question",
    category: "Project Management",
    question_type: "text",
    question_label: "What is the project name?",
    placeholder: "Enter project name",
    is_required: true,
    help_text: "Enter the official name of the project",
    validation: {
      min_length: 3,
      max_length: 100,
    },
  },
  {
    id: "template-2",
    name: "Project Status",
    description: "Project status dropdown",
    category: "Project Management",
    question_type: "select",
    question_label: "What is the current project status?",
    options: ["Not Started", "In Progress", "On Hold", "Completed", "Cancelled"],
    is_required: true,
  },
  {
    id: "template-3",
    name: "Daily Summary",
    description: "Daily work summary textarea",
    category: "Daily Reports",
    question_type: "textarea",
    question_label: "What did you accomplish today?",
    placeholder: "Describe your daily accomplishments...",
    is_required: true,
    help_text: "Provide a detailed summary of your work today",
    validation: {
      min_length: 50,
      max_length: 2000,
    },
  },
  {
    id: "template-4",
    name: "Hours Worked",
    description: "Number of hours worked",
    category: "Time Tracking",
    question_type: "number",
    question_label: "How many hours did you work today?",
    placeholder: "8",
    is_required: true,
    help_text: "Enter the total hours worked",
    validation: {
      min_value: 0,
      max_value: 24,
    },
  },
  {
    id: "template-5",
    name: "Satisfaction Rating",
    description: "1-5 satisfaction rating",
    category: "Feedback",
    question_type: "rating",
    question_label: "How satisfied are you with today's progress?",
    options: ["1", "2", "3", "4", "5"],
    is_required: false,
    help_text: "Rate your satisfaction from 1 (low) to 5 (high)",
  },
  {
    id: "template-6",
    name: "Email Contact",
    description: "Email address input",
    category: "Contact",
    question_type: "email",
    question_label: "What is your email address?",
    placeholder: "your.email@example.com",
    is_required: true,
    help_text: "Enter a valid email address",
  },
  {
    id: "template-7",
    name: "Priority Level",
    description: "Priority selection",
    category: "Project Management",
    question_type: "radio",
    question_label: "What is the priority level?",
    options: ["Low", "Medium", "High", "Critical"],
    is_required: true,
  },
  {
    id: "template-8",
    name: "Skills",
    description: "Multiple skills selection",
    category: "Skills",
    question_type: "multiselect",
    question_label: "Which skills did you use today?",
    options: ["Frontend", "Backend", "Database", "DevOps", "Design", "Testing", "Documentation"],
    is_required: false,
  },
  {
    id: "template-9",
    name: "Date Started",
    description: "Project start date",
    category: "Project Management",
    question_type: "date",
    question_label: "When did the project start?",
    is_required: true,
  },
  {
    id: "template-10",
    name: "Agreement Checkbox",
    description: "Terms and conditions acceptance",
    category: "Legal",
    question_type: "checkbox",
    question_label: "I agree to the terms and conditions",
    is_required: true,
  },
]

interface QuestionTemplatesProps {
  onSelectTemplate: (template: QuestionTemplate) => void
  selectedCategory?: string
}

export function QuestionTemplates({ onSelectTemplate, selectedCategory }: QuestionTemplatesProps) {
  const { toast } = useToast()
  
  const categories = Array.from(new Set(QUESTION_TEMPLATES.map(t => t.category)))
  const filteredTemplates = selectedCategory
    ? QUESTION_TEMPLATES.filter(t => t.category === selectedCategory)
    : QUESTION_TEMPLATES

  const handleUseTemplate = (template: QuestionTemplate) => {
    onSelectTemplate(template)
    toast({
      title: "Template Applied",
      description: `"${template.name}" template has been applied to your question form.`,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Question Templates</h3>
        <p className="text-sm text-muted-foreground">
          Choose from pre-built question templates to get started quickly
        </p>
      </div>

      {categories.length > 0 && !selectedCategory && (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge key={category} variant="outline">
              {category}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {template.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{template.question_label}</p>
                <Badge variant="outline" className="text-xs">
                  {template.question_type}
                </Badge>
              </div>
              
              {template.options && template.options.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.options.slice(0, 3).map((opt, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {opt}
                    </Badge>
                  ))}
                  {template.options.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.options.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleUseTemplate(template)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No templates found in this category
        </div>
      )}
    </div>
  )
}





