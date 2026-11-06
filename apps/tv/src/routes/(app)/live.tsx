import { createFileRoute } from "@tanstack/react-router"

import LivePage from "../../components/live-page"

export const Route = createFileRoute("/(app)/live")({
  component: LivePage,
})
