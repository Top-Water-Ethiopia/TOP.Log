import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AppWrapper } from '@/components/app-wrapper'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TOP Captain's Log - IT Department Daily Tracker",
  description: 'A modern IT Department Daily Tracker for documenting daily activities and maintaining comprehensive work records',
  keywords: ['daily log', 'it tracker', 'developer journal', 'work log'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <AppWrapper>
          {children}
          <Toaster position="bottom-right" richColors />
          <Analytics />
        </AppWrapper>
      </body>
    </html>
  )
}
