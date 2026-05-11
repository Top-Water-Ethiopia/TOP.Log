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

export {}

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/rbac/server", () => ({
  verifyPermissionForDepartmentFromRequest: jest.fn(),
}))

jest.mock("@/lib/server/marketing", () => ({
  getMarketingDepartmentId: jest.fn(),
}))

jest.mock("@/lib/time-window/visibility-signature", () => ({
  computeVisibilitySignature: jest.fn(),
}))

let createClient: any
let verifyPermissionForDepartmentFromRequest: any
let getMarketingDepartmentId: any
let computeVisibilitySignature: any

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    or: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("marketing dashboard KPI - posts prepared", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.resetModules()

    ;({ createClient } = jest.requireMock("@/lib/supabase/server"))
    ;({ verifyPermissionForDepartmentFromRequest } = jest.requireMock("@/lib/rbac/server"))
    ;({ getMarketingDepartmentId } = jest.requireMock("@/lib/server/marketing"))
    ;({ computeVisibilitySignature } = jest.requireMock("@/lib/time-window/visibility-signature"))

    jest.spyOn(console, "info").mockImplementation(() => {})
    getMarketingDepartmentId.mockResolvedValue("dept-marketing")
    verifyPermissionForDepartmentFromRequest.mockResolvedValue({ ok: true, userId: "user-1", roleId: "role-1" })
    computeVisibilitySignature.mockResolvedValue("sig")
  })

  afterEach(() => {
    ;(console.info as any).mockRestore?.()
  })

  it("counts uploaded assets by composite (entry_kind, question_key) and trims response keys", async () => {
    const fromMock = jest.fn()
      // role_questions discovery
      .mockReturnValueOnce(
        createThenableBuilder({
          data: [
            {
              question_label: "What content did you share today?",
              question_type: "image",
              entry_kind: "dmal",
              metadata: { legacy_question_key: "what_content_did_you_share_today" },
            },
            {
              question_label: "What post content did you share today? ...",
              question_type: "image",
              entry_kind: "daily_supervisors_report",
              metadata: { legacy_question_key: "what_post_content_did_you_share_today" },
            },
          ],
          error: null,
        })
      )
      // custom_responses candidates
      .mockReturnValueOnce(
        createThenableBuilder({
          data: [
            // should count 2 (mixed array: 1 strict + 1 compat)
            {
              question_key: " what_content_did_you_share_today ",
              value: [
                { provider: "cloudinary", publicId: "a" },
                { provider: "cloudinary", secure_url: "https://x", resource_type: "image" },
                { provider: "cloudinary", secure_url: "https://x" }, // invalid (no resource marker)
              ],
              captain_log_entries: { entry_kind: "dmal" },
            },
            // should count 5 (strict assets)
            {
              question_key: "what_post_content_did_you_share_today",
              value: new Array(5).fill(0).map((_, i) => ({ provider: "cloudinary", publicId: `p${i}` })),
              captain_log_entries: { entry_kind: "daily_supervisors_report" },
            },
            // composite mismatch: key ok but wrong entry_kind => 0
            {
              question_key: "what_post_content_did_you_share_today",
              value: [{ provider: "cloudinary", publicId: "x" }],
              captain_log_entries: { entry_kind: "dmal" },
            },
            // adversarial: provider+url only => 0
            {
              question_key: "what_content_did_you_share_today",
              value: { provider: "cloudinary", secure_url: "https://example.com", foo: "bar" },
              captain_log_entries: { entry_kind: "dmal" },
            },
          ],
          error: null,
        })
      )

    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    }
    createClient.mockResolvedValue(supabase)

    const route = require("@/app/api/marketing/kpis/posts-prepared/route")
    const request: any = {
      url: "http://localhost/api/marketing/kpis/posts-prepared?dateFrom=2026-05-09&dateTo=2026-05-09",
    }

    const res = await route.GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kpi).toBe("posts_prepared")
    // 2 + 5 = 7
    expect(body.value).toBe(7)
  })

  it("returns 0 when no configured pairs resolve (no label fallback)", async () => {
    const fromMock = jest.fn().mockReturnValueOnce(createThenableBuilder({ data: [], error: null }))
    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: fromMock,
    }
    createClient.mockResolvedValue(supabase)

    const route = require("@/app/api/marketing/kpis/posts-prepared/route")
    const request: any = {
      url: "http://localhost/api/marketing/kpis/posts-prepared?dateFrom=2026-05-09&dateTo=2026-05-09",
    }

    const res = await route.GET(request)
    const body = await res.json()
    expect(body.value).toBe(0)
    // Should only query role_questions; no custom_responses query.
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith("role_questions")
  })
})
