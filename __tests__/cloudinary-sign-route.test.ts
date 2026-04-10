jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status ?? 200,
      async json() {
        return body
      },
    }),
  },
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const { createClient } = jest.requireMock("@/lib/supabase/server")
const routeModule = require("@/app/api/uploads/cloudinary/sign/route")

describe("/api/uploads/cloudinary/sign", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "demo-cloud",
      NEXT_PUBLIC_CLOUDINARY_API_KEY: "demo-key",
      CLOUDINARY_API_SECRET: "demo-secret",
      CLOUDINARY_UPLOAD_FOLDER: "captain-log-test",
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns a signed Cloudinary upload payload for authenticated users", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    })

    const response = await routeModule.POST({
      json: async () => ({ resourceType: "image" }),
    } as Request)

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.data.cloudName).toBe("demo-cloud")
    expect(body.data.apiKey).toBe("demo-key")
    expect(body.data.folder).toBe("captain-log-test")
    expect(body.data.resourceType).toBe("image")
    expect(typeof body.data.timestamp).toBe("number")
    expect(typeof body.data.signature).toBe("string")
    expect(body.data.signature.length).toBeGreaterThan(0)
  })
})
