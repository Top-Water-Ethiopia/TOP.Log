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

  test("typing '091' matches a member with +2519... phone when phone is visible (len guard)", async () => {
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
    fireEvent.change(input, { target: { value: "091" } })

    // Debounce is 150ms
    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    // Should still show Alice (matched by phone prefix 091 -> +25191...)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.queryByText(/No results for/)).toBeNull()
  })

  test("typing '78' shows no results and shows phone helper hint", async () => {
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
    expect(await screen.findByText("Alice")).toBeInTheDocument()

    const input = screen.getByPlaceholderText("Search by name or phone…")
    fireEvent.change(input, { target: { value: "78" } })

    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    expect(screen.queryByText("Alice")).toBeNull()
    expect(screen.getByText(/No results for/)).toBeInTheDocument()
    expect(screen.getByText("Enter at least 5 digits to search by phone number.")).toBeInTheDocument()
  })

  test("mixed query (name + short digits) matches by name and does not show phone hint", async () => {
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
    expect(await screen.findByText("Alice")).toBeInTheDocument()

    const input = screen.getByPlaceholderText("Search by name or phone…")
    fireEvent.change(input, { target: { value: "alice 78" } })

    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.queryByText("Enter at least 5 digits to search by phone number.")).toBeNull()
  })
})
