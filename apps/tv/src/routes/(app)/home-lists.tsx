import { createFileRoute } from "@tanstack/react-router"

import HomeListsPage from "../../components/home-lists-page"

export const Route = createFileRoute("/(app)/home-lists")({
  component: HomeListsPage,
})
