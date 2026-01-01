import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AppWrapper } from '@/components/app-wrapper'
import './globals.css'

// Import Inter and IBM Plex Mono fonts from Google Fonts
import { Inter } from 'next/font/google'
import { IBM_Plex_Mono } from 'next/font/google'

// Configure the fonts with subsets and weights
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Logs - IT Department Daily Tracker",
  description: 'A modern IT Department Daily Tracker for documenting daily activities and maintaining comprehensive work records',
  keywords: ['daily log', 'it tracker', 'developer journal', 'work log'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body className={`${inter.className} ${ibmPlexMono.variable} antialiased`}>
        <AppWrapper>
          {children}
          <Toaster position="bottom-right" richColors />
          <Analytics />
        </AppWrapper>
      </body>
    </html>
  )
}