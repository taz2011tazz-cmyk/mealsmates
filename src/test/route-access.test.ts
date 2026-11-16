import { describe, expect, it } from "vitest";
import { isPublicMealMateRoute } from "@/lib/route-access";

describe("MealMate guest route access", () => {
  it("allows recipe discovery and recipe details without an account", () => {
    expect(isPublicMealMateRoute("/")).toBe(true);
    expect(isPublicMealMateRoute("/recipes")).toBe(true);
    expect(isPublicMealMateRoute("/recipe/chicken-curry")).toBe(true);
  });

  it("allows Dining browsing while keeping personal pages protected", () => {
    expect(isPublicMealMateRoute("/restaurants")).toBe(true);
    expect(isPublicMealMateRoute("/restaurant/local-cafe")).toBe(true);
    expect(isPublicMealMateRoute("/planner")).toBe(false);
    expect(isPublicMealMateRoute("/pantry")).toBe(false);
    expect(isPublicMealMateRoute("/profile")).toBe(false);
    expect(isPublicMealMateRoute("/checkout")).toBe(false);
    expect(isPublicMealMateRoute("/chat")).toBe(false);
  });

  it("does not treat similarly named private routes as public", () => {
    expect(isPublicMealMateRoute("/recipes-private")).toBe(false);
    expect(isPublicMealMateRoute("/recipe")).toBe(false);
    expect(isPublicMealMateRoute("/restaurant")).toBe(false);
  });
});