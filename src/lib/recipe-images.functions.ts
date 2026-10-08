import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RECIPE_COLS =
  "id,name,cuisine,category,meal_type,description,diet_tags,ingredients,created_by,image_url,image_source,image_confidence,image_locked,image_signature,image_checked_at";

const IdSchema = z.object({ recipeId: z.string().uuid() });

async function loadRecipe(recipeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("recipes").select(RECIPE_COLS).eq("id", recipeId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Recipe not found");
  return data;
}

async function assertCanEdit(userId: string, createdBy: string | null) {
  if (createdBy && createdBy === userId) return;
  const { isAdmin } = await import("@/lib/marketplace.server");
  if (!(await isAdmin(userId))) throw new Error("Only the recipe owner or an admin can change this image");
}

/**
 * Called when a recipe is shown without a verified photo. Uses the stored image
 * when it is trustworthy; otherwise searches once and saves the result.
 * Safe to call from public pages: work is cached per recipe and rate limited.
 */
export const ensureRecipeImage = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => IdSchema.parse(v))
  .handler(async ({ data }) => {
    const srv = await import("@/lib/recipe-images.server");
    const r = await loadRecipe(data.recipeId);
    const signature = srv.recipeSignature(r);
    if (!srv.needsSearch(r, signature)) {
      return { imageUrl: r.image_source ? r.image_url : null, source: r.image_source, confidence: r.image_confidence, searched: false };
    }
    if (srv.configuredProviders().length === 0) {
      return { imageUrl: null, source: null, confidence: null, searched: false, reason: "no_provider" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Global throttle protects the image APIs from bursts of page views.
    const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", { _bucket: "recipe_image_search", _identifier: "global", _max_per_minute: 20 });
    if (allowed === false) return { imageUrl: null, source: null, confidence: null, searched: false, reason: "rate_limited" };

    // Claim the recipe so concurrent viewers don't trigger duplicate searches.
    await srv.markChecked(r.id, signature);
    const result = await srv.findBestImage(r);
    if (!result.best || !result.query) {
      return { imageUrl: null, source: null, confidence: null, searched: true, reason: result.reason };
    }
    await srv.saveImage(r.id, result.best, result.query, { signature });
    return { imageUrl: result.best.url, source: result.best.provider, confidence: result.best.score ?? null, searched: true };
  });

export const getImageAlternatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdSchema.parse(v))
  .handler(async ({ data, context }) => {
    const srv = await import("@/lib/recipe-images.server");
    const r = await loadRecipe(data.recipeId);
    await assertCanEdit(context.userId, r.created_by);
    if (srv.configuredProviders().length === 0) return { options: [], reason: "no_provider" as const };
    const options = await srv.findAlternatives(r);
    return {
      options: options.map((c) => ({
        provider: c.provider,
        id: c.id,
        url: c.url,
        thumb: c.thumb,
        title: c.title.slice(0, 120),
        photographer: c.photographer ?? null,
        photographerUrl: c.photographerUrl ?? null,
        pageUrl: c.pageUrl ?? null,
        score: c.score ?? 0,
      })),
      reason: null,
    };
  });

const ChooseSchema = z.object({
  recipeId: z.string().uuid(),
  provider: z.enum(["Unsplash", "Pexels", "Bing"]),
  id: z.string().min(1).max(300),
});

export const chooseRecipeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ChooseSchema.parse(v))
  .handler(async ({ data, context }) => {
    const srv = await import("@/lib/recipe-images.server");
    const r = await loadRecipe(data.recipeId);
    await assertCanEdit(context.userId, r.created_by);
    // Only accept a photo that our own search returned (never an arbitrary client URL).
    const options = await srv.findAlternatives(r, 20);
    const pick = options.find((c) => c.provider === data.provider && c.id === data.id);
    if (!pick) throw new Error("That image is no longer available. Please pick another.");
    await srv.saveImage(r.id, { ...pick, score: Math.max(pick.score ?? 0, 95) }, `manual: ${srv.buildQueries(r)[0]}`, {
      locked: true,
      signature: srv.recipeSignature(r),
    });
    return { imageUrl: pick.url };
  });

/** Admin backfill: processes a small batch of recipes missing a verified photo. */
export const backfillRecipeImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ batchSize: z.number().int().min(1).max(10).default(5) }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await import("@/lib/marketplace.server");
    if (!(await isAdmin(context.userId))) throw new Error("Admin access required");
    const srv = await import("@/lib/recipe-images.server");
    if (srv.configuredProviders().length === 0) return { processed: 0, updated: 0, remaining: 0, reason: "no_provider" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("recipes")
      .select(RECIPE_COLS)
      .eq("image_locked", false)
      .or(`image_source.is.null,image_confidence.lt.${srv.ACCEPT_THRESHOLD}`)
      .order("image_checked_at", { ascending: true, nullsFirst: true })
      .limit(data.batchSize * 3);
    if (error) throw error;
    const todo = (rows ?? []).filter((r) => srv.needsSearch(r, srv.recipeSignature(r))).slice(0, data.batchSize);
    let updated = 0;
    for (const r of todo) {
      const signature = srv.recipeSignature(r);
      await srv.markChecked(r.id, signature);
      const res = await srv.findBestImage(r);
      if (res.best && res.query) {
        await srv.saveImage(r.id, res.best, res.query, { signature });
        updated++;
      }
    }
    const { count } = await supabaseAdmin
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("image_locked", false)
      .or(`image_source.is.null,image_confidence.lt.${srv.ACCEPT_THRESHOLD}`);
    return { processed: todo.length, updated, remaining: Math.max(0, (count ?? 0) - updated), reason: null };
  });

export const imageProvidersStatus = createServerFn({ method: "GET" }).handler(async () => {
  const srv = await import("@/lib/recipe-images.server");
  return { providers: srv.configuredProviders(), ai: !!process.env["LOVABLE_API_KEY"] };
});
