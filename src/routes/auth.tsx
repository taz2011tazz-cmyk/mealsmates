import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "MealMate account | MealMate" },
      { name: "description", content: "Continue to your MealMate account." },
      { property: "og:title", content: "MealMate account | MealMate" },
      { property: "og:description", content: "Continue to your MealMate account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/profile", replace: true });
  },
  component: () => null,
});
