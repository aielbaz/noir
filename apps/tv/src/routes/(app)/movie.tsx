import { createFileRoute } from "@tanstack/react-router"

import MoviePage from "../../components/movie-page"

export const Route = createFileRoute("/(app)/movie")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: search.id != null ? String(search.id) : undefined,
  }),
  component: MoviePage,
})
