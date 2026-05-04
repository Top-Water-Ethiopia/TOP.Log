'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FormDialogProps
  extends Omit<React.ComponentProps<typeof Dialog>, 'children'> {
  trigger?: React.ReactElement
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  form?: Omit<React.ComponentProps<'form'>, 'children'>
  contentClassName?: string
  showCloseButton?: boolean
  contentProps?: Omit<
    React.ComponentProps<typeof DialogContent>,
    'children' | 'className' | 'showCloseButton'
  >
}

function FormDialog({
  trigger,
  title,
  description,
  children,
  footer,
  form,
  contentClassName,
  showCloseButton,
  contentProps,
  ...dialogProps
}: FormDialogProps) {
  const body = (
    <>
      {children}
      {footer ? <DialogFooter>{footer}</DialogFooter> : null}
    </>
  )

  return (
    <Dialog {...dialogProps}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn(contentClassName)}
        showCloseButton={showCloseButton}
        {...contentProps}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {form ? <form {...form}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  )
}

export type { FormDialogProps }
export { FormDialog }
