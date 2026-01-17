import ReactMarkdown from "react-markdown"

interface MarkdownProps {
  /** The markdown content to render */
  children: string
  /** Additional CSS classes to apply to the container */
  className?: string
}

/**
 * Component for rendering markdown content.
 * Used primarily for rendering LLM responses in the chat interface.
 */
export function Markdown({ children, className = "" }: MarkdownProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Open links in new tab
          a: ({ children, href, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          // Ensure code blocks have proper styling
          pre: ({ children, ...props }) => (
            <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 dark:bg-zinc-800" {...props}>
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }) => {
            // Inline code vs block code detection
            const isBlock = className?.includes("language-")
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800" {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
