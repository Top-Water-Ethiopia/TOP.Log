"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Rocket, AlertTriangle, BookOpen, Calendar, Bug, Eye, File } from "lucide-react"
import { templates, type EntryTemplate } from "@/lib/templates"
import * as LucideIcons from "lucide-react"

interface TemplateDialogProps {
  onSelectTemplate: (template: EntryTemplate) => void
}

export function TemplateDialog({ onSelectTemplate }: TemplateDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelectTemplate = (template: EntryTemplate) => {
    onSelectTemplate(template)
    setIsOpen(false)
  }

  // Get icon component from icon name string
  const getIconComponent = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName]
    return Icon || FileText // Fallback to FileText if icon not found
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Entry Templates</DialogTitle>
          <DialogDescription>Choose a template to quickly fill out your log entry</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  {(() => {
                    const IconComponent = getIconComponent(template.icon)
                    return <IconComponent className="h-8 w-8 flex-shrink-0" />
                  })()}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
