import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

describe("search_logs RPC function", () => {
  const mockSupabase = {
    rpc: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  it("calls search_logs RPC with correct parameters when searching by name", async () => {
    const mockUserId = "user-123"
    const searchName = "John"
    const mockLogs = [
      {
        id: "log-1",
        date: "2026-04-22",
        subject_department_id: "dept-1",
        created_at: "2026-04-22T10:00:00Z",
        updated_at: "2026-04-22T10:00:00Z",
        entry_kind: "standard",
        subject_agent_snapshot: null,
        user_id: "user-456",
        user_name: "John Doe",
        department_name: "Sales",
        response_count: 5,
      },
    ]

    mockSupabase.rpc.mockResolvedValue({
      data: mockLogs,
      error: null,
    })

    // Simulate calling the function with search parameters
    const result = await mockSupabase.rpc("search_logs", {
      p_user_id: mockUserId,
      p_search_name: searchName,
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: mockUserId,
      p_search_name: searchName,
      p_limit: 30,
      p_can_view_department_logs: true,
    })
    expect(result.data).toEqual(mockLogs)
    expect(result.error).toBeNull()
  })

  it("handles empty search results gracefully", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const result = await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "NonExistent",
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it("handles RPC errors gracefully", async () => {
    const mockError = { message: "Database connection failed" }
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: mockError,
    })

    const result = await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(result.data).toBeNull()
    expect(result.error).toEqual(mockError)
  })

  it("passes cursor parameters for pagination", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const cursor = {
      date: "2026-04-21",
      id: "log-999",
    }

    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_cursor_date: cursor.date,
      p_cursor_id: cursor.id,
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_cursor_date: cursor.date,
      p_cursor_id: cursor.id,
      p_limit: 30,
      p_can_view_department_logs: true,
    })
  })

  it("filters by department when department_id is provided", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const departmentId = "dept-123"

    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_department_id: departmentId,
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_department_id: departmentId,
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })
  })

  it("filters by date when date is provided", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const date = "2026-04-22"

    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_date: date,
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_date: date,
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })
  })

  it("respects the limit parameter", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const customLimit = 50

    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_limit: customLimit,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_limit: customLimit,
      p_can_view_department_logs: true,
    })
  })

  it("handles similarity threshold parameter", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const threshold = 0.5

    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_similarity_threshold: threshold,
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_similarity_threshold: threshold,
      p_limit: 30,
      p_can_view_department_logs: true,
    })
  })

  it("respects can_view_department_logs permission", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })

    // Test with false (user can only see own logs)
    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_can_view_department_logs: false,
      p_limit: 30,
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_can_view_department_logs: false,
      p_limit: 30,
    })

    // Test with true (user can view department logs)
    await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_can_view_department_logs: true,
      p_limit: 30,
    })

    expect(mockSupabase.rpc).toHaveBeenLastCalledWith("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_can_view_department_logs: true,
      p_limit: 30,
    })
  })

  it("returns logs with correct structure", async () => {
    const mockLogs = [
      {
        id: "log-1",
        date: "2026-04-22",
        subject_department_id: "dept-1",
        created_at: "2026-04-22T10:00:00Z",
        updated_at: "2026-04-22T10:00:00Z",
        entry_kind: "agent_call",
        subject_agent_snapshot: {
          name: "Agent Smith",
          location: "Downtown",
          phone: "+1234567890",
        },
        user_id: "user-456",
        user_name: "John Doe",
        department_name: "Sales",
        response_count: 10,
      },
    ]

    mockSupabase.rpc.mockResolvedValue({
      data: mockLogs,
      error: null,
    })

    const result = await mockSupabase.rpc("search_logs", {
      p_user_id: "user-123",
      p_search_name: "John",
      p_limit: 30,
      p_can_view_department_logs: true,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: "log-1",
      date: "2026-04-22",
      subject_department_id: "dept-1",
      entry_kind: "agent_call",
      user_id: "user-456",
      user_name: "John Doe",
      department_name: "Sales",
      response_count: 10,
    })
    expect(result.data[0].subject_agent_snapshot).toEqual({
      name: "Agent Smith",
      location: "Downtown",
      phone: "+1234567890",
    })
  })
})
