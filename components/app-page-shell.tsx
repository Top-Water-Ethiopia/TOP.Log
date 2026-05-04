"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "./ui/button"

type AppPageShellProps = {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  actions?: ReactNode
  children: ReactNode
}

export function AppPageShell({
  title,
  description,
  backHref = "/",
  backLabel = "Back",
  actions,
  children,
}: AppPageShellProps) {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="text-muted-foreground mt-2">{description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
            {actions}
          </div>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
