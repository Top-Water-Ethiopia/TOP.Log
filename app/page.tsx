"use client"

import { useState, useEffect } from "react"
import { CaptainLogProvider } from "@/contexts/captain-log-context"
import { MainLayout } from "@/components/main-layout"

export default function Home() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return null
  }

  return (
    <CaptainLogProvider>
      <MainLayout />
    </CaptainLogProvider>
  )
}
