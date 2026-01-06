'use client'

import * as React from 'react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface DataTableProps {
  isLoading?: boolean
  isEmpty?: boolean
  loadingFallback?: React.ReactNode
  emptyFallback?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function DataTable({
  isLoading,
  isEmpty,
  loadingFallback,
  emptyFallback,
  children,
  className,
}: DataTableProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        {loadingFallback ?? <Spinner className="size-6 text-muted-foreground" />}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        {emptyFallback ?? 'No results'}
      </div>
    )
  }

  return <div className={cn(className)}>{children}</div>
}

export type { DataTableProps }
export { DataTable }
