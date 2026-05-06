import { act, fireEvent, render, screen } from "@testing-library/react"
import MarketingTeamPage from "@/app/marketing/team/page"

function mockFetchOnce(response: unknown, ok = true) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    json: async () => response,
  })
  // @ts-expect-error - test override
  global.fetch = fetchMock
  return fetchMock
}

describe("/marketing/team - component filtering", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  test("typing '09' matches a member with +2519... phone when phone is visible", async () => {
    mockFetchOnce({
      data: {
        department: { id: "d1", name: "Marketing", slug: "marketing" },
        members: [
          {
            userId: "u1",
            name: "Alice",
            phoneRaw: "+251911234567",
            phone: "+251 911 234 567",
            phoneVisible: true,
            role: { id: "r1", name: "sales_promoter", displayName: "Sales Promoter" },
            team: { membershipType: "profession", isPrimary: true },
            lastUpdated: "2026-05-06T00:00:00.000Z",
            stats: { summary: null, window: null },
          },
        ],
        meta: { hasMore: false },
      },
    })

    render(<MarketingTeamPage />)

    // Wait for initial load
    expect(await screen.findByText("Alice")).toBeInTheDocument()

    const input = screen.getByPlaceholderText("Search by name or phone…")
    fireEvent.change(input, { target: { value: "09" } })

    // Debounce is 150ms
    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    // Should still show Alice (matched by phone prefix 09 -> +2519...)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.queryByText(/No results for/)).toBeNull()
  })
})

