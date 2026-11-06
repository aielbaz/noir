import { createFileRoute } from "@tanstack/react-router"

import SeriesPage from "../../components/series-page"

export const Route = createFileRoute("/(app)/series")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: search.id != null ? String(search.id) : undefined,
  }),
  component: SeriesPage,
})
