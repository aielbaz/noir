import { createFileRoute } from "@tanstack/react-router"

import MoviesPage from "../../components/movies-page"

export const Route = createFileRoute("/(app)/movies")({
  component: MoviesPage,
})
