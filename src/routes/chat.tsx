import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { MascotMark } from "@/components/mealmate-logo";
import { askFoodQuestion } from "@/lib/ai.functions";
import { generateVisualExplanation, type VisualExplanation } from "@/lib/visual.functions";
// Heavy media player (images + audio narration) — only loaded when a visual answer exists.
const VisualExplainer = lazy(() =>
  import("@/components/visual-explainer").then((m) => ({ default: m.VisualExplainer })),
);
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "AI Food Chat & Visual Mode — MealMate" },
      {
        name: "description",
        content:
          "Ask MealMate anything about food and get an AI answer plus a narrated, animated visual explanation you can download.",
      },
      { property: "og:title", content: "AI Food Chat & Visual Mode — MealMate" },
      {
        property: "og:description",
        content: "AI answers with animated, narrated visual explanations for Premium members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SUGGESTIONS = [
  "How does photosynthesis work?",
  "What can I substitute for buttermilk?",
  "Explain intermittent fasting step by step",
  "What pairs well with bunny chow?",
];

type Turn = {
  question: string;
  answer: string;
  visual?: VisualExplanation;
  visualLoading?: boolean;
  visualError?: string;
};

function ChatPage() {
  const { isPremium } = usePremium();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [visualMode, setVisualMode] = useState(true);

  function patch(i: number, next: Partial<Turn>) {
    setTurns((t) => t.map((turn, idx) => (idx === i ? { ...turn, ...next } : turn)));
  }

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuestion("");
    const wantsVisual = isPremium && visualMode;
    const index = turns.length;
    setTurns((t) => [...t, { question: text, answer: "", visualLoading: wantsVisual }]);

    // Kick off the visual explanation in parallel with the text answer.
    const visualPromise = wantsVisual
      ? generateVisualExplanation({ data: { prompt: text, scenes: 4, narration: true } })
          .then((visual) => patch(index, { visual, visualLoading: false }))
          .catch((err: unknown) =>
            patch(index, {
              visualLoading: false,
              visualError: err instanceof Error ? err.message : "Visual generation failed",
            }),
          )
      : Promise.resolve();

    try {
      const { answer } = await askFoodQuestion({ data: { question: text } });
      patch(index, { answer });
    } catch (err) {
      patch(index, { answer: "" });
      toast.error("Couldn't answer that", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
      void visualPromise;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      <div className="flex items-center gap-3">
        <MascotMark className="h-12 w-12 shrink-0" alt="MealMate AI" />
        <div>
          <h1 className="font-display text-3xl leading-tight">AI Chat</h1>
          <p className="text-sm text-muted-foreground">Ask anything — get an answer and a visual.</p>
        </div>
      </div>

      {isPremium ? (
        <button
          type="button"
          onClick={() => setVisualMode((v) => !v)}
          className={`md3-surface mt-5 flex items-center gap-3 rounded-2xl border p-3 text-left text-sm ${
            visualMode ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600">
            <Wand2 className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block font-medium">Visual Mode {visualMode ? "on" : "off"}</span>
            <span className="block text-xs text-muted-foreground">
              Narrated animated explainer, 16:9 + 9:16, downloadable.
            </span>
          </span>
          <span
            className={`h-6 w-10 rounded-full p-0.5 transition-colors ${visualMode ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-background transition-transform ${visualMode ? "translate-x-4" : ""}`}
            />
          </span>
        </button>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Crown className="h-4 w-4 text-amber-500" /> Premium AI Visual Mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every answer also becomes a 15–30s narrated animated video with AI illustrations,
            subtitles, vertical + landscape versions and MP4 / image downloads.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/premium">Unlock Visual Mode</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 flex-1 space-y-6">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-border bg-card px-4 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {t.question}
            </p>
            {t.answer && (
              <p className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm">
                {t.answer}
              </p>
            )}
            {t.visualLoading && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Directing your animated explainer — illustrations + narration…
              </div>
            )}
            {t.visualError && (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-muted-foreground">
                Visual explanation unavailable: {t.visualError}
              </p>
            )}
            {t.visual && (
              <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
                <VisualExplainer data={t.visual} />
              </Suspense>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-24 mt-6 flex gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything — food, nutrition, how things work…"
          className="h-11 flex-1 rounded-full border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" disabled={busy} className="h-11 w-11 rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" /> AI answers can be wrong — use judgment for allergies and safety.
      </p>
    </main>
  );
}
