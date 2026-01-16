import { Repo } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"

let _repo: Repo | null = null

/**
 * Get the Automerge Repo instance with IndexedDB storage.
 * Creates the repo lazily on first access to avoid issues in non-browser environments.
 * This repo is used throughout the app for managing Automerge documents.
 */
export function getRepo(): Repo {
  if (!_repo) {
    _repo = new Repo({
      storage: new IndexedDBStorageAdapter("journal"),
    })
  }
  return _repo
}
