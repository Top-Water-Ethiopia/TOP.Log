/**
 * Test file for Marketing Agents Manager sidebar functionality
 * Tests:
 * 1. Save button triggers form submission
 * 2. Phones array is saved correctly
 * 3. Plates array is saved correctly
 * 4. Coverage array is saved correctly
 * 5. Keyboard shortcuts work (Escape to close, Cmd+Enter to save)
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MarketingAgentsManager } from "@/components/marketing-agents-manager"

// Mock the API client
jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}))

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => "/admin/marketing-agents"),
}))

describe("MarketingAgentsManager Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Save Button Functionality", () => {
    it("should trigger form submission when Save button is clicked", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
        },
      })

      render(<MarketingAgentsManager />)

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      // Click "Add Agent" button
      const addAgentButton = screen.getByText("Add Agent")
      fireEvent.click(addAgentButton)

      // Wait for sidebar to open
      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      // Fill in the form
      const nameInput = screen.getByLabelText(/Agent name/i)
      await fireEvent.change(nameInput, "Test Agent")

      const phoneInput = screen.getByPlaceholderText("0912345678")
      await fireEvent.change(phoneInput, "0912345678")

      // Click Save button
      const saveButton = screen.getByText("Create Agent")
      await fireEvent.click(saveButton)

      // Verify API was called with correct payload
      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/admin/marketing-agents",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("phones"),
          })
        )
      })
    })
  })

  describe("Phones Array Saving", () => {
    it("should save multiple phone numbers correctly", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
        },
      })

      render(<MarketingAgentsManager />)

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      // Open sidebar
      await fireEvent.click(screen.getByText("Add Agent"))

      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      // Fill in required fields
      await fireEvent.change(screen.getByLabelText(/Agent name/i), "Test Agent")

      // Add first phone
      const phoneInput1 = screen.getByPlaceholderText("0912345678")
      await fireEvent.change(phoneInput1, "0912345678")

      // Add second phone
      const addPhoneButton = screen.getByText("Add Phone")
      await fireEvent.click(addPhoneButton)

      const phoneInputs = screen.getAllByPlaceholderText("0912345678")
      expect(phoneInputs).toHaveLength(2)

      await fireEvent.change(phoneInputs[1], "0923456789")

      // Click Save
      await fireEvent.click(screen.getByText("Create Agent"))

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/admin/marketing-agents",
          expect.objectContaining({
            body: expect.stringMatching(/.*0912345678.*0923456789.*/s),
          })
        )
      })
    })
  })

  describe("Plates Array Saving", () => {
    it("should save multiple plate numbers correctly", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
        },
      })

      render(<MarketingAgentsManager />)

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      await fireEvent.click(screen.getByText("Add Agent"))

      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      await fireEvent.change(screen.getByLabelText(/Agent name/i), "Test Agent")
      await fireEvent.change(screen.getByPlaceholderText("0912345678"), "0912345678")

      // Add first plate
      const plateInput = screen.getByPlaceholderText("AA-1234")
      await fireEvent.change(plateInput, "AA-1234")

      // Add second plate
      const addPlateButton = screen.getByText("Add Plate")
      await fireEvent.click(addPlateButton)

      const plateInputs = screen.getAllByPlaceholderText("AA-1234")
      expect(plateInputs).toHaveLength(2)

      await fireEvent.change(plateInputs[1], "BB-5678")

      await fireEvent.click(screen.getByText("Create Agent"))

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/admin/marketing-agents",
          expect.objectContaining({
            body: expect.stringMatching(/.*AA-1234.*BB-5678.*/s),
          })
        )
      })
    })
  })

  describe("Coverage Array Saving", () => {
    it("should save coverage entries correctly", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
          regions: [{ id: "reg-1", name: "Addis Ababa" }],
          cities: [{ id: "city-1", name: "Bole" }],
          routes: [{ id: "route-1", name: "Route 1" }],
        },
      })

      render(<MarketingAgentsManager />)

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      await fireEvent.click(screen.getByText("Add Agent"))

      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      await fireEvent.change(screen.getByLabelText(/Agent name/i), "Test Agent")
      await fireEvent.change(screen.getByPlaceholderText("0912345678"), "0912345678")

      // Add coverage
      const addCoverageButton = screen.getByText("Add Coverage")
      await fireEvent.click(addCoverageButton)

      // The coverage should be visible
      await waitFor(() => {
        expect(screen.getByText(/Geographic coverage/i)).toBeInTheDocument()
      })

      await fireEvent.click(screen.getByText("Create Agent"))

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/admin/marketing-agents",
          expect.objectContaining({
            body: expect.stringContaining("coverage"),
          })
        )
      })
    })
  })

  describe("Keyboard Shortcuts", () => {
    it("should close sidebar on Escape key press", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
        },
      })

      render(<MarketingAgentsManager />)

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      await fireEvent.click(screen.getByText("Add Agent"))

      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      await waitFor(() => {
        expect(screen.queryByText(/Add Agent/)).not.toBeInTheDocument()
      })
    })

    it("should submit form on Cmd+Enter", async () => {
      const { apiFetch } = require("@/lib/api-client")
      apiFetch.mockResolvedValue({
        data: {
          department: { id: "dept-1", name: "Marketing" },
          salesPromoters: [
            {
              user_id: "user-1",
              name: "John Doe",
              email: "john@example.com",
              profession_key: "sales_promoter",
              profession_label: "Sales Promoter",
            },
          ],
          agents: [],
        },
      })

      render(<MarketingAgentsManager />)

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument()
      })

      await fireEvent.click(screen.getByText("Add Agent"))

      await waitFor(() => {
        expect(screen.getByText(/Add Agent/)).toBeInTheDocument()
      })

      await fireEvent.change(screen.getByLabelText(/Agent name/i), "Test Agent")
      await fireEvent.change(screen.getByPlaceholderText("0912345678"), "0912345678")

      // Press Cmd+Enter
      fireEvent.keyDown(document, { key: "Enter", metaKey: true })

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalled()
      })
    })
  })
})
