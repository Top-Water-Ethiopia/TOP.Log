"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ErrorPageProps {
  statusCode?: number
  title?: string
  message?: string
  showHomeButton?: boolean
  showBackButton?: boolean
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode = 404,
  title = 'Page not found',
  message = 'The page you requested is unavailable. It may have been moved, deleted, or the URL is incorrect.',
  showHomeButton = true,
  showBackButton = true,
}) => {
  const router = useRouter()

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${statusCode} — ${title}`
    }
  }, [statusCode, title])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center">
        <div className="mb-8">
          <div className="text-8xl font-bold text-primary mb-2">{statusCode}</div>
          <h1 className="text-2xl font-semibold text-foreground mb-4">{title}</h1>
          <p className="text-muted-foreground mb-8">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {showHomeButton && (
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to Homepage
            </Link>
          )}
          
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

export default function NotFoundPage() {
  return (
    <ErrorPage 
      statusCode={404}
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
    />
  )
}
