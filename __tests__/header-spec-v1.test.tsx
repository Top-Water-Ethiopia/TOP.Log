import React from "react"
import { render, screen } from "@testing-library/react"

import LogsLayoutShell from "@/components/logs-layout-shell"
import ReportsLayoutShell from "@/components/reports-layout-shell"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/reports/abc",
}))

// Render next/link as a plain anchor so we can assert href
jest.mock("next/link", () => {
  return ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...rest}>
      {children}
    </a>
  )
})

describe("Header Spec v1 (Non-Admin)", () => {
  it("brand click goes to /logs in logs header", () => {
    render(
      <LogsLayoutShell
        isAuthenticated={true}
        canAccessAdmin={false}
        canAccessLogs={true}
        canCreateNewLog={true}
        logsDisabledReason={null}
        createDisabledReason={null}
        viewerContact="user@example.com"
        viewerName="User"
      >
        <div />
      </LogsLayoutShell>
    )

    const brand = screen.getByRole("link", { name: /logs daily tracker/i })
    expect(brand).toHaveAttribute("href", "/logs")
  })

  it("brand click goes to /logs in reports header", () => {
    render(
      <ReportsLayoutShell
        isAuthenticated={true}
        canAccessAdmin={false}
        canAccessLogs={true}
        canCreateNewLog={true}
        logsDisabledReason={null}
        createDisabledReason={null}
        viewerContact="user@example.com"
        viewerName="User"
      >
        <div />
      </ReportsLayoutShell>
    )

    const brand = screen.getByRole("link", { name: /logs daily tracker/i })
    expect(brand).toHaveAttribute("href", "/logs")
  })

  it("shows New Log disabled with reason when cannot create", () => {
    render(
      <ReportsLayoutShell
        isAuthenticated={true}
        canAccessAdmin={false}
        canAccessLogs={true}
        canCreateNewLog={false}
        logsDisabledReason={null}
        createDisabledReason="All allowed dates are already submitted"
        viewerContact="user@example.com"
        viewerName="User"
      >
        <div />
      </ReportsLayoutShell>
    )

    const newLog = screen.getByRole("button", { name: /new log/i })
    expect(newLog).toBeDisabled()
    expect(newLog).toHaveAttribute("title", "All allowed dates are already submitted")
  })

  it("shows All Logs disabled with reason when user has no memberships", () => {
    render(
      <ReportsLayoutShell
        isAuthenticated={true}
        canAccessAdmin={false}
        canAccessLogs={false}
        canCreateNewLog={false}
        logsDisabledReason="No department access assigned"
        createDisabledReason="No department access assigned"
        viewerContact="user@example.com"
        viewerName="User"
      >
        <div />
      </ReportsLayoutShell>
    )

    const allLogs = screen.getByRole("button", { name: /all logs/i })
    expect(allLogs).toBeDisabled()
    expect(allLogs).toHaveAttribute("title", "No department access assigned")
  })
})
