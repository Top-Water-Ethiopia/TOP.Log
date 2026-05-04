'use client'

import * as React from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ActionMenuAlign = React.ComponentProps<typeof DropdownMenuContent>['align']

type ActionMenuItem =
  | {
      type: 'item'
      asChild?: false
      key?: string
      label: React.ReactNode
      icon?: React.ReactNode
      onSelect?: () => void
      disabled?: boolean
      destructive?: boolean
      keepOpen?: boolean
      className?: string
      title?: string
    }
  | {
      type: 'item'
      key?: string
      asChild: true
      node: React.ReactElement
      onSelect?: () => void
      disabled?: boolean
      destructive?: boolean
      keepOpen?: boolean
      className?: string
      title?: string
    }
  | {
      type: 'separator'
      key?: string
    }
  | {
      type: 'label'
      key?: string
      label: React.ReactNode
      inset?: boolean
      className?: string
    }
  | {
      type: 'custom'
      key?: string
      node: React.ReactNode
    }

interface ActionMenuProps
  extends Omit<React.ComponentProps<typeof DropdownMenu>, 'children'> {
  trigger: React.ReactElement
  items?: ActionMenuItem[]
  children?: React.ReactNode
  align?: ActionMenuAlign
  contentClassName?: string
  contentProps?: Omit<
    React.ComponentProps<typeof DropdownMenuContent>,
    'children' | 'className' | 'align'
  >
}

function ActionMenu({
  trigger,
  items,
  children,
  align = 'end',
  contentClassName,
  contentProps,
  ...menuProps
}: ActionMenuProps) {
  return (
    <DropdownMenu {...menuProps}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(contentClassName)}
        {...contentProps}
      >
        {items
          ? items.map((item, index) => {
              const key = item.key ?? `action-menu-item-${index}`

              if (item.type === 'separator') {
                return <DropdownMenuSeparator key={key} />
              }

              if (item.type === 'label') {
                return (
                  <DropdownMenuLabel
                    key={key}
                    inset={item.inset}
                    className={cn(item.className)}
                  >
                    {item.label}
                  </DropdownMenuLabel>
                )
              }

              if (item.type === 'custom') {
                return <React.Fragment key={key}>{item.node}</React.Fragment>
              }

              if (item.type === 'item' && item.asChild) {
                return (
                  <DropdownMenuItem
                    key={key}
                    asChild
                    variant={item.destructive ? 'destructive' : 'default'}
                    disabled={item.disabled}
                    className={cn(item.className)}
                    title={item.title}
                    onSelect={(e) => {
                      if (item.keepOpen) {
                        e.preventDefault()
                      }
                      item.onSelect?.()
                    }}
                  >
                    {item.node}
                  </DropdownMenuItem>
                )
              }

              if (item.type !== 'item') {
                return null
              }

              return (
                <DropdownMenuItem
                  key={key}
                  variant={item.destructive ? 'destructive' : 'default'}
                  disabled={item.disabled}
                  className={cn(item.className)}
                  title={item.title}
                  onSelect={(e) => {
                    if (item.keepOpen) {
                      e.preventDefault()
                    }
                    item.onSelect?.()
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              )
            })
          : children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type { ActionMenuItem, ActionMenuProps }
export { ActionMenu }
