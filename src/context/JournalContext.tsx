import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { RepoContext, useDocument } from "@automerge/automerge-repo-react-hooks"
import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo"
import type { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge"
import { getRepo } from "../lib/repo"
import type { JournalDoc } from "../types/journal"

const JOURNAL_DOC_KEY = "journal-doc-url"

/**
 * Default initial state for a new journal document
 */
const createInitialDoc = (): JournalDoc => ({
  entries: {},
  settings: {
    displayName: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: "system",
    llmProvider: "claude",
  },
})

interface JournalContextValue {
  /** The current journal document state */
  doc: Doc<JournalDoc> | undefined
  /** Function to change the journal document */
  changeDoc: (changeFn: ChangeFn<JournalDoc>, options?: ChangeOptions<JournalDoc>) => void
  /** The document handle for direct access */
  handle: DocHandle<JournalDoc> | undefined
  /** Whether the document is still loading */
  isLoading: boolean
}

const JournalContext = createContext<JournalContextValue | null>(null)

/**
 * Hook to access the journal document and change function
 * @throws Error if used outside of JournalProvider
 */
export function useJournal(): JournalContextValue {
  const context = useContext(JournalContext)
  if (!context) {
    throw new Error("useJournal must be used within a JournalProvider")
  }
  return context
}

interface JournalProviderProps {
  children: ReactNode
}

/**
 * Inner component that uses the document hook after RepoContext is available
 */
function JournalDocumentProvider({
  children,
  docUrl,
  handle,
  isLoading: isUrlLoading,
}: {
  children: ReactNode
  docUrl: AutomergeUrl | undefined
  handle: DocHandle<JournalDoc> | undefined
  isLoading: boolean
}) {
  // Use the document hook once we have a URL
  const result = useDocument<JournalDoc>(docUrl)
  const [doc, changeDoc] = result ?? [undefined, () => {}]

  const value: JournalContextValue = {
    doc,
    changeDoc,
    handle,
    isLoading: isUrlLoading || doc === undefined,
  }

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}

/**
 * Provider component that wraps the app and provides access to the Automerge journal document.
 * Handles document creation/loading and persists the document URL to localStorage.
 */
export function JournalProvider({ children }: JournalProviderProps) {
  const repo = getRepo()
  const [docUrl, setDocUrl] = useState<AutomergeUrl | undefined>(undefined)
  const [handle, setHandle] = useState<DocHandle<JournalDoc> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize or load the document
  useEffect(() => {
    const initDoc = async () => {
      const storedUrl = localStorage.getItem(JOURNAL_DOC_KEY)

      if (storedUrl) {
        // Load existing document
        const docHandle = await repo.find<JournalDoc>(storedUrl as AutomergeUrl)
        setHandle(docHandle)
        setDocUrl(storedUrl as AutomergeUrl)
      } else {
        // Create new document
        const docHandle = repo.create<JournalDoc>(createInitialDoc())
        localStorage.setItem(JOURNAL_DOC_KEY, docHandle.url)
        setHandle(docHandle)
        setDocUrl(docHandle.url)
      }

      setIsLoading(false)
    }

    initDoc()
  }, [repo])

  return (
    <RepoContext.Provider value={repo}>
      <JournalDocumentProvider docUrl={docUrl} handle={handle} isLoading={isLoading}>
        {children}
      </JournalDocumentProvider>
    </RepoContext.Provider>
  )
}
