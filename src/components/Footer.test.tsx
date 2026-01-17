import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Footer } from "./Footer"

describe("Footer", () => {
  it("renders the footer element", () => {
    render(<Footer />)
    expect(screen.getByRole("contentinfo")).toBeInTheDocument()
  })

  it("renders the settings link", () => {
    render(<Footer />)
    const link = screen.getByRole("link", { name: /settings/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "#/settings")
  })

  it("displays settings text", () => {
    render(<Footer />)
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("has proper styling classes", () => {
    render(<Footer />)
    const footer = screen.getByRole("contentinfo")
    expect(footer).toHaveClass("border-t", "p-4")
  })

  it("right-aligns the settings link", () => {
    render(<Footer />)
    const footer = screen.getByRole("contentinfo")
    const container = footer.firstElementChild
    expect(container).toHaveClass("justify-end")
  })
})
