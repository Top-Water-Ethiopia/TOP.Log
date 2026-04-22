import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Distinguished-grade Invalidation Engine.
 * Provides a secure, internal way for client operations to trigger 
 * server-side cache flushes across user and department scopes.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { tags } = await req.json()
    if (Array.isArray(tags)) {
      tags.forEach(tag => {
        console.log(`[Revalidate] Purging tag: ${tag}`)
        revalidateTag(tag, "page")
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
