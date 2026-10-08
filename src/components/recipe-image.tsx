import { useEffect, useState } from "react";
import {
  categoryFallbackUrl,
  curatedRecipeImageUrl,
  IMAGE_DIMENSIONS,
  type ImageRecipeLike,
  type ImageSize,
} from "@/lib/recipe-image";
import { ensureRecipeImage } from "@/lib/recipe-images.functions";

// One lookup per recipe per page session, shared by every card showing it.
const pending = new Map<string, Promise<string | null>>();

function lookup(recipeId: string): Promise<string | null> {
  let p = pending.get(recipeId);
  if (!p) {
    p = ensureRecipeImage({ data: { recipeId } })
      .then((r) => r.imageUrl ?? null)
      .catch(() => null);
    pending.set(recipeId, p);
  }
  return p;
}

/** Stored photo is trusted only when it came from the verified image search. */
function verifiedUrl(r: ImageRecipeLike): string | null {
  return r.image_source && r.image_url ? r.image_url : null;
}

/**
 * Renders a recipe photo that always depicts the dish (or a neutral category
 * placeholder). Order: verified stored photo -> audited bundled photo ->
 * category placeholder while a verified photo is looked up once in the background.
 */
export function RecipeImage({
  recipe,
  size = "card",
  className,
  priority = false,
  alt,
}: {
  recipe: ImageRecipeLike;
  size?: ImageSize;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const stored = verifiedUrl(recipe);
  const curated = curatedRecipeImageUrl(recipe, size);
  const fallback = categoryFallbackUrl(recipe);
  const initial = stored ?? curated ?? fallback;
  const [src, setSrc] = useState(initial);

  useEffect(() => {
    setSrc(initial);
    if (stored || curated || !recipe.id) return;
    let alive = true;
    void lookup(recipe.id).then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [initial, stored, curated, recipe.id]);

  return (
    <img
      src={src}
      alt={alt ?? recipe.name}
      width={IMAGE_DIMENSIONS[size].width}
      height={IMAGE_DIMENSIONS[size].height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setSrc(curated ?? fallback)}
      className={className}
    />
  );
}
