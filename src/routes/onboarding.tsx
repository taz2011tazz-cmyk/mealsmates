import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MascotMark } from "@/components/mealmate-logo";
import { usePreferences } from "@/hooks/use-preferences";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { type FoodPreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Personalise MealMate" },
      { name: "description", content: "Tell MealMate what you enjoy so recipes, plans and restaurants fit you." },
      { property: "og:title", content: "Personalise MealMate" },
      { property: "og:description", content: "Tell MealMate what you enjoy so recipes, plans and restaurants fit you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

const FOOD_STYLES = ["Home cooking", "Fast food", "Healthy", "High protein", "Vegetarian", "Vegan", "Comfort food", "African cuisine", "Italian", "Asian", "Desserts", "Something else"];
const PRIORITIES = ["Discover restaurants", "Cook at home", "Plan meals", "Eat healthier", "Save money", "Try new foods", "Order food"];
const ALLERGIES = ["Nuts", "Peanuts", "Dairy", "Gluten", "Eggs", "Shellfish", "Fish", "Soy"];
const DIETS = ["Halaal", "Kosher", "Vegetarian", "Vegan", "Low carb", "Dairy-free"];
const COOKING_LEVELS = ["Beginner", "Comfortable", "Confident"];
const COOKING_TIMES = ["Under 15 min", "15–30 min", "30–60 min", "No rush"];

type Phase = 0 | 1 | 2 | "saving" | "done";

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        try {
          navigator.vibrate?.(6);
        } catch {
          /* unsupported */
        }
        onClick();
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-95",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40",
      )}
    >
      {selected && <Check className="h-3.5 w-3.5 motion-safe:animate-in motion-safe:zoom-in-50" />}
      {label}
    </button>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { preferences, save } = usePreferences();
  const [phase, setPhase] = useState<Phase>(0);
  const [draft, setDraft] = useState<FoodPreferences>(preferences);
  const [firstName, setFirstName] = useState("");

  useEffect(() => setDraft(preferences), [preferences]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, unknown>;
    const name = (meta["display_name"] ?? meta["full_name"] ?? meta["name"] ?? user.email?.split("@")[0] ?? "") as string;
    setFirstName(name.split(" ")[0] ?? "");
  }, [user]);

  async function finish(next: FoodPreferences) {
    setPhase("saving");
    try {
      await save({ ...next, onboarding_completed: true });
      if (user) {
        const { error } = await supabase.from("profiles").update({ tour_completed: true } as never).eq("id", user.id);
        if (error) console.error("[onboarding] tour flag", error);
      }
      setPhase("done");
    } catch {
      toast.error("We couldn't save your preferences. Check your connection and try again.");
      setPhase(2);
    }
  }

  const skip = () => finish(draft);

  if (phase === "saving") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center text-center" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h1 className="mt-6 font-display text-3xl">Building your MealMate.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Saving your preferences to your account…</p>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
          <MascotMark className="size-28 rounded-3xl" />
          <h1 className="mt-8 font-display text-4xl">You're all set.</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Welcome to MealMate{firstName ? `, ${firstName}` : ""}.
          </p>
        </div>
        <Button size="lg" className="h-14 w-full rounded-full text-base" onClick={() => navigate({ to: "/", replace: true })}>
          Start Exploring
        </Button>
      </Shell>
    );
  }

  const step = phase;
  const titles = ["What's your food style?", "What's most important to you?", "Tell us a little more."];

  return (
    <Shell>
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button type="button" aria-label="Back" onClick={() => setPhase((step - 1) as Phase)} className="-ml-2 rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary" : "w-1.5 bg-border")} />
          ))}
        </div>
        <button type="button" onClick={skip} className="rounded-full px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>

      <div key={step} className="mt-8 flex-1 overflow-y-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{titles[step]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 2 ? "Optional — this keeps unsafe ingredients out of your suggestions." : "Choose as many as you like."}
        </p>

        {step === 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {FOOD_STYLES.map((o) => (
              <Chip key={o} label={o} selected={draft.favorite_foods.includes(o)} onClick={() => setDraft((d) => ({ ...d, favorite_foods: toggle(d.favorite_foods, o) }))} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {PRIORITIES.map((o) => (
              <Chip key={o} label={o} selected={draft.preferred_features.includes(o)} onClick={() => setDraft((d) => ({ ...d, preferred_features: toggle(d.preferred_features, o) }))} />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-6">
            <Group title="Allergies">
              {ALLERGIES.map((o) => (
                <Chip key={o} label={o} selected={draft.allergies.includes(o)} onClick={() => setDraft((d) => ({ ...d, allergies: toggle(d.allergies, o) }))} />
              ))}
            </Group>
            <Group title="Dietary needs">
              {DIETS.map((o) => (
                <Chip key={o} label={o} selected={draft.dietary_restrictions.includes(o)} onClick={() => setDraft((d) => ({ ...d, dietary_restrictions: toggle(d.dietary_restrictions, o) }))} />
              ))}
            </Group>
            <Group title="Cooking level">
              {COOKING_LEVELS.map((o) => (
                <Chip key={o} label={o} selected={draft.cooking_level === o} onClick={() => setDraft((d) => ({ ...d, cooking_level: d.cooking_level === o ? null : o }))} />
              ))}
            </Group>
            <Group title="Time to cook">
              {COOKING_TIMES.map((o) => (
                <Chip key={o} label={o} selected={draft.cooking_time === o} onClick={() => setDraft((d) => ({ ...d, cooking_time: d.cooking_time === o ? null : o }))} />
              ))}
            </Group>
            <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
              <Crown className="h-4 w-4 shrink-0 text-primary" />
              MealMate Premium adds unlimited AI meal plans and extra themes. You can explore it any time from your profile.
            </p>
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="mt-6 h-14 w-full rounded-full text-base active:scale-[0.98]"
        onClick={() => (step < 2 ? setPhase((step + 1) as Phase) : finish(draft))}
      >
        {step < 2 ? "Continue" : "Finish"}
      </Button>
    </Shell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)]">
        {children}
      </div>
    </div>,
    document.body,
  );
}
