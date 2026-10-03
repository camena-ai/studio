import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MessageContent } from "./message-content.tsx"

const renderMarkdown = (markdown: string) =>
  render(<MessageContent markdown={markdown} />).container

describe("MessageContent", () => {
  it("renders Markdown", () => {
    const container = renderMarkdown("**bold** and `code`")
    expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe("bold")
    expect(container.querySelector("code")?.textContent).toBe("code")
  })

  it("blocks an external image", () => {
    const container = renderMarkdown("![tracker](https://images.example.test/pixel.png)")
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))
    expect(sources).not.toContain("https://images.example.test/pixel.png")
    expect(container.innerHTML).not.toContain("images.example.test/pixel.png")
  })

  it("blocks a data: image", () => {
    const container = renderMarkdown("![x](data:image/png;base64,iVBORw0KGgo=)")
    expect(container.querySelector('img[src^="data:"]')).toBeNull()
  })

  it("blocks a javascript: link and keeps an https link", () => {
    const container = renderMarkdown(
      "[bad](javascript:alert(1)) and [good](https://docs.example.test/page)",
    )
    expect(container.innerHTML).not.toContain("javascript:")
    expect(container.textContent).toContain("bad [blocked]")
    // Streamdown's link safety renders kept links as a button that confirms before opening.
    const links = [...container.querySelectorAll('[data-streamdown="link"]')]
    expect(links.map((link) => link.textContent)).toEqual(["good"])
  })
})
