import { createFileRoute } from "@tanstack/react-router"

import BannerPage from "../../components/banner-page"

export const Route = createFileRoute("/(app)/banner")({
  component: BannerPage,
})
