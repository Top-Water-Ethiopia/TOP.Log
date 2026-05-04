"use client"

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {

  useEffect(() => {
    console.error('Error:', error)
    if (typeof document !== 'undefined') {
      document.title = '500 — Server Error'
    }
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center">
        <div className="mb-8">
          <div className="text-8xl font-bold text-destructive mb-2">500</div>
          <h1 className="text-2xl font-semibold text-foreground mb-4">
            Something went wrong!
          </h1>
          <p className="text-muted-foreground mb-8">
            We're sorry, but something went wrong on our end. Our team has been notified and we're working to fix it.
            Please try again later or contact support if the problem persists.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  )
}
