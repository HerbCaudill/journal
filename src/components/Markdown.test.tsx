import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Markdown } from "./Markdown"

describe("Markdown component", () => {
  describe("basic rendering", () => {
    it("renders plain text", () => {
      render(<Markdown>Hello, world!</Markdown>)
      expect(screen.getByText("Hello, world!")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<Markdown className="custom-class">Test</Markdown>)
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("has prose classes for styling", () => {
      const { container } = render(<Markdown>Test</Markdown>)
      expect(container.firstChild).toHaveClass("prose")
      expect(container.firstChild).toHaveClass("prose-sm")
    })
  })

  describe("markdown formatting", () => {
    it("renders bold text", () => {
      render(<Markdown>This is **bold** text</Markdown>)
      const boldElement = screen.getByText("bold")
      expect(boldElement.tagName).toBe("STRONG")
    })

    it("renders italic text", () => {
      render(<Markdown>This is *italic* text</Markdown>)
      const italicElement = screen.getByText("italic")
      expect(italicElement.tagName).toBe("EM")
    })

    it("renders headings", () => {
      render(<Markdown># Heading 1</Markdown>)
      const heading = screen.getByRole("heading", { level: 1 })
      expect(heading).toHaveTextContent("Heading 1")
    })

    it("renders unordered lists", () => {
      render(<Markdown>{"- Item 1\n- Item 2\n- Item 3"}</Markdown>)
      expect(screen.getByText("Item 1")).toBeInTheDocument()
      expect(screen.getByText("Item 2")).toBeInTheDocument()
      expect(screen.getByText("Item 3")).toBeInTheDocument()
    })

    it("renders ordered lists", () => {
      render(<Markdown>{"1. First\n2. Second\n3. Third"}</Markdown>)
      expect(screen.getByText("First")).toBeInTheDocument()
      expect(screen.getByText("Second")).toBeInTheDocument()
      expect(screen.getByText("Third")).toBeInTheDocument()
    })

    it("renders paragraphs", () => {
      render(<Markdown>{"Paragraph one.\n\nParagraph two."}</Markdown>)
      expect(screen.getByText("Paragraph one.")).toBeInTheDocument()
      expect(screen.getByText("Paragraph two.")).toBeInTheDocument()
    })
  })

  describe("links", () => {
    it("renders links", () => {
      render(<Markdown>Check out [this link](https://example.com)</Markdown>)
      const link = screen.getByRole("link", { name: "this link" })
      expect(link).toHaveAttribute("href", "https://example.com")
    })

    it("opens links in new tab", () => {
      render(<Markdown>Check out [this link](https://example.com)</Markdown>)
      const link = screen.getByRole("link", { name: "this link" })
      expect(link).toHaveAttribute("target", "_blank")
    })

    it("has noopener noreferrer for security", () => {
      render(<Markdown>Check out [this link](https://example.com)</Markdown>)
      const link = screen.getByRole("link", { name: "this link" })
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    })
  })

  describe("code", () => {
    it("renders inline code", () => {
      render(<Markdown>Use the `console.log()` function</Markdown>)
      const codeElement = screen.getByText("console.log()")
      expect(codeElement.tagName).toBe("CODE")
    })

    it("renders code blocks", () => {
      const codeBlock = "```javascript\nconst x = 1;\n```"
      render(<Markdown>{codeBlock}</Markdown>)
      expect(screen.getByText(/const x = 1;/)).toBeInTheDocument()
    })

    it("code blocks are wrapped in pre element", () => {
      const codeBlock = "```javascript\nconst x = 1;\n```"
      const { container } = render(<Markdown>{codeBlock}</Markdown>)
      const preElement = container.querySelector("pre")
      expect(preElement).toBeInTheDocument()
    })
  })

  describe("blockquotes", () => {
    it("renders blockquotes", () => {
      render(<Markdown>{"> This is a quote"}</Markdown>)
      const quote = screen.getByText("This is a quote")
      expect(quote.closest("blockquote")).toBeInTheDocument()
    })
  })
})
