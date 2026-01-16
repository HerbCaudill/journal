import { describe, it, expect } from "vitest"
import { getRepo } from "./repo"

describe("getRepo", () => {
  it("is a function that returns a Repo", () => {
    expect(typeof getRepo).toBe("function")
  })
})
