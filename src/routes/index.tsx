import { RecipeImage } from "@/components/recipe-image";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Search,
  SlidersHorizontal,
  Camera,
  Loader2,
  User as UserIcon,
  MessageCircleQuestion,
  ShoppingCart,
  Calendar,
  ChevronRight,
  Play,
  HeartPulse,
} from "lucide-react";
import { toast } from "sonner";
import {
  trendingRecipesQuery,
  southAfricanFavoritesQuery,
  myFavoritesQuery,
  myPantryQuery,
} from "@/lib/queries";
import { surpriseMe, generateRecipe } from "@/lib/ai.functions";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { getContinueCooking } from "@/lib/continue-cooking";
import { TrendingCard } from "@/components/recipe-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CookingInput } from "@/components/cooking-input";
import { ChefMascot } from "@/components/chef-mascot";
import { MealMateLogo } from "@/components/mealmate-logo";
import { pantryRecipeQuery } from "@/lib/pantry-recipe";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanStatusCard } from "@/components/plan-status-card";
import { XpChip } from "@/components/xp-chip";
import { AdSlot } from "@/components/ad-slot";
import { usePreferences } from "@/hooks/use-preferences";
import { personalize } from "@/lib/preferences";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MealMate — Cook the world, one recipe at a time" },
      { name: "description", content: "Discover South African favourites and global recipes, then plan, shop, and cook with MealMate." },
      { property: "og:title", content: "MealMate — Cook the world, one recipe at a time" },
      { property: "og:description", content: "Discover South African favourites and global recipes, then plan, shop, and cook with MealMate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const CATEGORY_PILLS = [
  { label: "Breakfast", emoji: "🍳", search: { c: "Breakfast" } },
  { label: "Lunch", emoji: "🥣", search: { c: "Lunch" } },
  { label: "Dinner", emoji: "🍛", search: { c: "Dinner" } },
  { label: "Dessert", emoji: "🍰", search: { c: "Dessert" } },
  { label: "Snacks", emoji: "🍿", search: { c: "Snacks" } },
  { label: "South African", emoji: "🇿🇦", search: { c: "South African Favorites" } },
  { label: "Healthy", emoji: "🌿", search: { c: "Healthy Meals" } },
  { label: "Vegan", emoji: "🌱", search: { c: "Vegan" } },
] as const;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { preferences, hasPreferences } = usePreferences();
  const {
    data: trendingRaw = [],
    isLoading: trendingLoading,
    error: trendingError,
  } = useQuery(trendingRecipesQuery());
  const {
    data: southAfricanRaw = [],
    isLoading: southAfricanLoading,
    error: southAfricanError,
  } = useQuery(southAfricanFavoritesQuery());
  const recipeText = (r: { name: string; description?: string | null; cuisine?: string | null; category?: string | null; diet_tags?: string[] | null }) =>
    [r.name, r.description ?? null, r.cuisine ?? null, r.category ?? null, r.diet_tags ?? []];
  const trending = personalize(hasPreferences ? preferences : null, trendingRaw ?? [], recipeText);
  const southAfrican = southAfricanRaw
    ? personalize(hasPreferences ? preferences : null, southAfricanRaw, recipeText)
    : southAfricanRaw;
  const { data: favorites } = useQuery({ ...myFavoritesQuery(), enabled: !!user });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<null | "search" | "surprise">(null);
  const [continueCooking, setContinueCooking] = useState<ReturnType<typeof getContinueCooking>>(null);
  const [salutation, setSalutation] = useState("Hello");
  useEffect(() => { setContinueCooking(getContinueCooking()); setSalutation(greeting()); }, []);
  const { data: pantry = [] } = useQuery({ ...myPantryQuery(), enabled: !!user });

  const favoriteIds = new Set((favorites ?? []).map((f) => f.recipe_id));

  async function findFromPantry() {
    const pantryQuery = pantryRecipeQuery(pantry.map((item) => item.name));
    if (!pantryQuery) { navigate({ to: "/pantry" }); return; }
    if (busy) return;
    setBusy("search");
    try {
      const { slug } = await generateRecipe({ data: { query: pantryQuery } });
      navigate({ to: "/recipe/$slug", params: { slug } });
    } catch { toast.error("Couldn't find a recipe right now. Please try again."); }
    finally { setBusy(null); }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy("search");
    try {
      const { slug } = await generateRecipe({ data: { query: query.trim() } });
      navigate({ to: "/recipe/$slug", params: { slug } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const authError = /AUTH_REQUIRED|Unauthorized|Invalid user session|No authorization/i.test(message);
    const aiError = /AI_NOT_CONFIGURED|AI_REQUEST_FAILED|Groq|gateway/i.test(message);
    toast.error(authError ? "Your session expired" : "Couldn't cook that up", {
      description: authError
        ? "Please sign in again to cook a recipe."
        : aiError
          ? "The kitchen assistant is unavailable right now. Please try again."
          : "Try again in a moment.",
    });
    } finally {
      setBusy(null);
    }
  }

  async function handleSurprise() {
    if (busy) return;
    setBusy("surprise");
    try {
      const { slug } = await surpriseMe();
      navigate({ to: "/recipe/$slug", params: { slug } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const authError = /AUTH_REQUIRED|Unauthorized|Invalid user session|No authorization/i.test(message);
      toast.error(authError ? "Your session expired" : "The chef is busy", {
        description: authError
          ? "Please sign in again to cook a recipe."
          : "The kitchen assistant is unavailable right now. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleFavorite(recipeId: string) {
    if (!user) {
      toast.info("Sign in to save favorites");
      return;
    }
    if (favoriteIds.has(recipeId)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, recipe_id: recipeId });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  return (
    <main className="flex-1">
      <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 px-5 pt-5">
        <ThemeToggle />
        <Link to="/" className="min-w-0 justify-self-center" aria-label="MealMate home"><MealMateLogo imageClassName="size-8 rounded-none object-contain" /></Link>
        <Button asChild size="icon" variant="ghost" className="size-11 rounded-full"><Link to="/profile" aria-label="Profile"><UserIcon /></Link></Button>
      </header>
      <section className="flex flex-col items-center px-5 pb-7 pt-8 text-center sm:pt-10">
        <ChefMascot animate className="h-44 w-44 sm:h-52 sm:w-52" />
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight sm:text-4xl">{salutation}, Chef.</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">Ready to cook something amazing?</p>
        <Button className="mt-6 h-12 rounded-full px-7" onClick={findFromPantry} disabled={busy !== null}>{busy === "search" ? <Loader2 className="animate-spin" /> : <Sparkles />} Find a recipe</Button>
      </section>
      <div className="mx-auto w-full max-w-xl px-5 pb-5">
        <CookingInput value={query} onChange={setQuery} onSubmit={() => navigate({ to: "/chat", search: { q: query.trim() } })} />
      </div>

      {/* Category pills */}
      <section className="px-5 pt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CATEGORY_PILLS.map((c) => (
            <Link
              key={c.label}
              to="/recipes"
              search={c.search}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </Link>
          ))}
          <Link
            to="/recipes"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <span aria-hidden>⊞⊞</span>
            More
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2 px-5 pt-6">
        {[
          { to: "/cookbook", icon: Search, label: "Cookbook" },
          { to: "/list", icon: ShoppingCart, label: "Shopping" },
          { to: "/coach", icon: HeartPulse, label: "Nutrition" },
          { to: "/restaurants", icon: Calendar, label: "Dining" },
        ].map((action) => <Button key={action.to} asChild variant="ghost" className="h-auto min-h-16 flex-col gap-2 rounded-lg px-1 py-3 text-xs"><Link to={action.to}><action.icon className="size-5" />{action.label}</Link></Button>)}
      </section>
      <div className="px-5 pt-4 text-center"><Button variant="ghost" className="h-11 rounded-full" onClick={handleSurprise} disabled={busy !== null}>{busy === "surprise" ? <Loader2 className="animate-spin" /> : <Sparkles />} Surprise me</Button></div>

      {/* Plan status + premium features */}
      <section className="px-4 pt-6">
        <PlanStatusCard />
      </section>

      {/* Sponsored (free plan only) */}
      <section className="px-4 pt-6">
        <AdSlot slot="home_feed" />
      </section>

      {/* Trending recipes */}
      <section className="pt-8">
        <div className="mb-3 flex items-end justify-between px-4">
          <h2 className="font-display text-2xl">Trending Recipes</h2>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {trendingLoading ? (
          <div className="flex gap-4 overflow-x-auto px-4 pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-40 flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : trendingError ? (
          <div className="mx-4 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Recipes are temporarily unavailable. You can still use the rest of MealMate.</p>
          </div>
        ) : trending.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {trending.map((r, i) => (
              <TrendingCard
                key={r.id}
                recipe={r}
                isFavorite={favoriteIds.has(r.id)}
                onToggleFavorite={toggleFavorite}
                priority={i < 2}
              />
            ))}
          </div>
        ) : (
          <div className="mx-4 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">
              No recipes yet — hit <strong>Surprise me</strong> above to create the first one!
            </p>
          </div>
        )}
      </section>

      {/* South African favourites */}
      <section className="pt-8">
        <div className="mb-3 flex items-end justify-between px-4">
          <h2 className="font-display text-2xl">South African Favourites</h2>
          <Link
            to="/recipes"
            search={{ c: "South African Favorites" }}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {southAfricanLoading ? (
          <div className="flex gap-4 overflow-x-auto px-4 pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-24 flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : southAfricanError ? (
          <p className="px-4 text-sm text-muted-foreground">This section is temporarily unavailable.</p>
        ) : southAfrican.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {southAfrican.map((r) => (
              <Link
                key={r.id}
                to="/recipe/$slug"
                params={{ slug: r.slug }}
                className="w-24 flex-shrink-0 text-center"
              >
                <div className="aspect-square w-24 overflow-hidden rounded-2xl bg-muted">
                  <RecipeImage recipe={r} size="thumb" className="h-full w-full object-cover" />

                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight">{r.name}</p>
              </Link>
            ))}
          </div>
        ) : southAfrican ? (
          <div className="mx-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            South African recipes will show up here once you generate a few.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto px-4 pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-24 flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        )}
      </section>

      {/* Continue cooking */}
      {continueCooking && (
        <section className="px-4 pt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-2xl">Continue Cooking</h2>
            <Link
              to="/recipes"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Link
            to="/recipe/$slug"
            params={{ slug: continueCooking.slug }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
              <RecipeImage
                recipe={continueCooking}
                size="thumb"
                className="h-full w-full object-cover"
              />

            </div>
            <div className="flex-1">
              <p className="font-display text-lg leading-tight">{continueCooking.name}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${continueCooking.progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{continueCooking.progress}% complete</span>
                {continueCooking.cooking_time_minutes && (
                  <span>{continueCooking.cooking_time_minutes} min</span>
                )}
                {continueCooking.calories && <span>{continueCooking.calories} cal</span>}
              </div>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink text-background">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
          </Link>
        </section>
      )}

    </main>
  );
}
