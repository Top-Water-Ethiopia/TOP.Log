import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RoleBasedQuestionFields } from "@/components/role-based-question-fields"

jest.mock("@/contexts/supabase-auth-context", () => ({
  useSupabaseAuth: () => ({
    user: { id: "user-123", email: "sam@example.com" },
    profile: { id: "profile-1", user_id: "user-123", name: "Sam Tester", role_id: "admin-role", department_id: null, is_active: true, metadata: null, last_login: null },
  }),
}))

describe("RoleBasedQuestionFields uploads", () => {
  const originalFetch = global.fetch
  const originalXMLHttpRequest = global.XMLHttpRequest
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  class MockXMLHttpRequest {
    static responses: string[] = []
    static autoLoad = true

    upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null }
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    onload: (() => void) | null = null
    status = 200
    responseText = ""

    open() {}
    send() {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent<EventTarget>)
      this.responseText = MockXMLHttpRequest.responses.shift() || ""
      if (MockXMLHttpRequest.autoLoad) {
        this.onload?.()
      }
    }
    abort() {
      this.onabort?.()
    }
  }

  beforeEach(() => {
    global.fetch = jest.fn()
    ;(global as any).XMLHttpRequest = MockXMLHttpRequest
    MockXMLHttpRequest.responses = []
    MockXMLHttpRequest.autoLoad = true
    URL.createObjectURL = jest.fn(() => "blob:preview")
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    ;(global as any).XMLHttpRequest = originalXMLHttpRequest
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    jest.restoreAllMocks()
  })

  it("uploads an image to Cloudinary and stores the uploaded asset array with attribution", async () => {
    const onChange = jest.fn()
    const fetchMock = global.fetch as jest.MockedFunction<typeof global.fetch>

    fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cloudName: "demo-cloud",
            apiKey: "demo-key",
            folder: "captain-log-test",
            timestamp: 1234567890,
            signature: "signed-value",
            resourceType: "image",
          },
        }),
      } as Response)

    MockXMLHttpRequest.responses = [
      JSON.stringify({
        public_id: "captain-log/sample",
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/sample.jpg",
        original_filename: "sample",
        bytes: 2048,
        format: "jpg",
      }),
    ]

    const { container } = render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "proof_image",
            label: "Proof image",
            type: "image",
            required: false,
            order: 1,
          },
        ]}
        responses={{}}
        onChange={onChange}
        renderMode="fieldsOnly"
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    const file = new File(["image"], "sample.jpg", { type: "image/jpeg" })

    fireEvent.change(input!, {
      target: {
        files: [file],
      },
    })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        "proof_image",
        [
          expect.objectContaining({
            provider: "cloudinary",
            secureUrl: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/sample.jpg",
            originalFilename: "sample",
            format: "jpg",
            uploadedByUserId: "user-123",
            uploadedByDisplayName: "Sam Tester",
            uploadedAt: expect.stringMatching(/Z$/),
          }),
        ]
      )
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/uploads/cloudinary/sign",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("100% uploaded")).toBeInTheDocument()
  })

  it("supports multiple image mode and preserves selection order in emitted arrays", async () => {
    const onChange = jest.fn()
    const fetchMock = global.fetch as jest.MockedFunction<typeof global.fetch>

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cloudName: "demo-cloud",
            apiKey: "demo-key",
            folder: "captain-log-test",
            timestamp: 1234567890,
            signature: "signed-value",
            resourceType: "image",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cloudName: "demo-cloud",
            apiKey: "demo-key",
            folder: "captain-log-test",
            timestamp: 1234567891,
            signature: "signed-value-2",
            resourceType: "image",
          },
        }),
      } as Response)
    MockXMLHttpRequest.responses = [
      JSON.stringify({
        public_id: "captain-log/first",
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/first.jpg",
        original_filename: "first",
        bytes: 1111,
        format: "jpg",
      }),
      JSON.stringify({
        public_id: "captain-log/second",
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/second.jpg",
        original_filename: "second",
        bytes: 2222,
        format: "jpg",
      }),
    ]

    const { container } = render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "gallery",
            label: "Gallery",
            type: "image",
            required: false,
            order: 1,
            metadata: { image_upload_mode: "multiple" },
            imageUploadMode: "multiple",
          },
        ]}
        responses={{}}
        onChange={onChange}
        renderMode="fieldsOnly"
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    const files = [
      new File(["image-one"], "first.jpg", { type: "image/jpeg" }),
      new File(["image-two"], "second.jpg", { type: "image/jpeg" }),
    ]

    fireEvent.change(input!, {
      target: {
        files,
      },
    })

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        "gallery",
        [
          expect.objectContaining({ publicId: "captain-log/first", originalFilename: "first" }),
          expect.objectContaining({ publicId: "captain-log/second", originalFilename: "second" }),
        ]
      )
    })
  })

  it("rejects files beyond the 20 image limit with inline feedback", async () => {
    const onChange = jest.fn()
    const { container } = render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "gallery",
            label: "Gallery",
            type: "image",
            required: false,
            order: 1,
            metadata: { image_upload_mode: "multiple" },
            imageUploadMode: "multiple",
          },
        ]}
        responses={{
          gallery: Array.from({ length: 20 }, (_, index) => ({
            provider: "cloudinary",
            resourceType: "image",
            publicId: `captain-log/${index}`,
            secureUrl: `https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/${index}.jpg`,
            originalFilename: `${index}.jpg`,
            bytes: 100,
            format: "jpg",
          })),
        }}
        onChange={onChange}
        renderMode="fieldsOnly"
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    fireEvent.change(input!, {
      target: {
        files: [new File(["overflow"], "overflow.jpg", { type: "image/jpeg" })],
      },
    })

    expect(await screen.findByText("You can upload up to 20 images for this question.")).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("removing a pending upload prevents ghost completion from reappearing", async () => {
    const onChange = jest.fn()
    const fetchMock = global.fetch as jest.MockedFunction<typeof global.fetch>

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cloudName: "demo-cloud",
          apiKey: "demo-key",
          folder: "captain-log-test",
          timestamp: 1234567890,
          signature: "signed-value",
          resourceType: "image",
        },
      }),
    } as Response)

    MockXMLHttpRequest.autoLoad = false
    MockXMLHttpRequest.responses = [
      JSON.stringify({
        public_id: "captain-log/pending",
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/captain-log/pending.jpg",
        original_filename: "pending",
        bytes: 1111,
        format: "jpg",
      }),
    ]

    const { container } = render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "gallery",
            label: "Gallery",
            type: "image",
            required: false,
            order: 1,
          },
        ]}
        responses={{}}
        onChange={onChange}
        renderMode="fieldsOnly"
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    fireEvent.change(input!, {
      target: {
        files: [new File(["pending"], "pending.jpg", { type: "image/jpeg" })],
      },
    })

    const removeButton = await screen.findByText("Remove")
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("gallery", [])
    })

    expect(screen.queryByText("pending")).not.toBeInTheDocument()
  })

  it("reports pending upload state changes, dedupes repeated values, and unregisters on unmount", async () => {
    const onChange = jest.fn()
    const onUploadPendingStateChange = jest.fn()
    const fetchMock = global.fetch as jest.MockedFunction<typeof global.fetch>

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cloudName: "demo-cloud",
          apiKey: "demo-key",
          folder: "captain-log-test",
          timestamp: 1234567890,
          signature: "signed-value",
          resourceType: "image",
        },
      }),
    } as Response)

    MockXMLHttpRequest.autoLoad = false

    const { container, unmount } = render(
      <RoleBasedQuestionFields
        questions={[
          {
            key: "gallery",
            label: "Gallery",
            type: "image",
            required: false,
            order: 1,
          },
        ]}
        responses={{}}
        onChange={onChange}
        onUploadPendingStateChange={onUploadPendingStateChange}
        renderMode="fieldsOnly"
      />
    )

    expect(onUploadPendingStateChange).toHaveBeenNthCalledWith(1, "gallery", false)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null
    fireEvent.change(input!, {
      target: {
        files: [new File(["pending"], "pending.jpg", { type: "image/jpeg" })],
      },
    })

    await waitFor(() => {
      expect(onUploadPendingStateChange).toHaveBeenCalledWith("gallery", true)
    })

    expect(onUploadPendingStateChange.mock.calls.filter((call) => call[0] === "gallery" && call[1] === true)).toHaveLength(1)

    unmount()

    expect(onUploadPendingStateChange).toHaveBeenLastCalledWith("gallery", false)
  })
})
