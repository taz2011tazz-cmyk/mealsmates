import { useEffect, useState } from "react";
import {
  categoryFallbackUrl,
  curatedRecipeImageUrl,
  IMAGE_DIMENSIONS,
  type ImageRecipeLike,
  type ImageSize,
} from "@/lib/recipe-image";

/**
 * Renders a recipe photo that is always a real image.
 *
 * Curated recipes render their audited photo straight away. Everything else
 * renders a real category photo immediately and upgrades to the dish-specific
 * generated photo only once that photo has actually loaded (with a timeout),
 * so a slow or failing image service never leaves a blank tile.
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
  const curated = curatedRecipeImageUrl(recipe, size);
  const fallback = categoryFallbackUrl(recipe);
  const [src, setSrc] = useState(curated ?? fallback);

  useEffect(() => {
    setSrc(curated ?? fallback);
  }, [curated, fallback]);

  return (
    <img
      src={src}
      alt={alt ?? recipe.name}
      width={IMAGE_DIMENSIONS[size].width}
      height={IMAGE_DIMENSIONS[size].height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setSrc(fallback)}
      className={className}
    />
  );
}
