import { createHashHistory, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

// Hash history: the packaged webOS app is served from a file URL, where
// path-based routing cannot survive a reload.
export const router = createRouter({ routeTree, history: createHashHistory() })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
