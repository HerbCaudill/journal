import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Header } from "./Header"

describe("Header", () => {
  it("renders the formatted date", () => {
    render(<Header date="2024-01-15" />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent("Monday, January 15, 2024")
  })

  it("renders a settings link", () => {
    render(<Header date="2024-01-15" />)

    const settingsLink = screen.getByRole("link", { name: /settings/i })
    expect(settingsLink).toBeInTheDocument()
    expect(settingsLink).toHaveAttribute("href", "#/settings")
  })

  it("formats different dates correctly", () => {
    render(<Header date="2024-06-20" />)

    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading).toHaveTextContent("Thursday, June 20, 2024")
  })
})
