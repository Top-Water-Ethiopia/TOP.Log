import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createCloudinarySignature, getCloudinaryConfig, type CloudinaryResourceType } from "@/lib/cloudinary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isCloudinaryResourceType(value: unknown): value is CloudinaryResourceType {
  return value === "image" || value === "raw" || value === "auto"
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const requestedType = body && typeof body === "object" ? (body as { resourceType?: unknown }).resourceType : null
    const resourceType = isCloudinaryResourceType(requestedType) ? requestedType : "auto"

    const { cloudName, apiKey, folder } = getCloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createCloudinarySignature({ timestamp, folder, resourceType })

    return NextResponse.json({
      data: {
        cloudName,
        apiKey,
        folder,
        timestamp,
        signature,
        resourceType,
      },
    })
  } catch (error) {
    console.error("Failed to sign Cloudinary upload:", error)
    return NextResponse.json({ error: "Failed to initialize upload" }, { status: 500 })
  }
}
