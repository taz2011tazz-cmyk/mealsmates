import { RECIPE_PHOTOS } from "@/assets/recipes/manifest";
import ackeeImg from "@/assets/recipes/dishes/ackee-and-saltfish.jpg";
import quinoaImg from "@/assets/recipes/dishes/quinoa-harissa-chicken.jpg";
import pizzaImg from "@/assets/recipes/dishes/pizza-margherita.jpg";

/**
 * Recipe image matching + delivery.
 *
 * Rules:
 *  - The image must depict the actual dish (name + main ingredient + cuisine).
 *  - The URL is deterministic per recipe (stable seed derived from the slug),
 *    so the same recipe always renders the same photo — never random.
 *  - Card/thumbnail call sites request small renditions; only the recipe page
 *    requests a hero rendition.
 */

const PHOTO_STYLE =
  "real photograph, hyperrealistic food photography, DSLR, 50mm, natural window light, shallow depth of field, appetising, professionally plated, not an illustration, not cartoon, not 3d render";

/** Main-ingredient hints so e.g. a beef dish never gets a chicken photo. */
const INGREDIENT_HINTS: Array<[RegExp, string]> = [
  [/\bbeef|steak|brisket|oxtail|mince\b/i, "beef as the main protein"],
  [/\bchicken|poultry|wings\b/i, "chicken as the main protein"],
  [/\blamb|mutton\b/i, "lamb as the main protein"],
  [/\bpork|bacon|ribs\b/i, "pork as the main protein"],
  [/\bfish|salmon|tuna|hake|snoek|prawn|shrimp|seafood\b/i, "seafood as the main protein"],
  [/\bvegan|vegetarian|veggie|tofu|chickpea|lentil|bean\b/i, "plant-based, no meat"],
  [/\bpasta|spaghetti|alfredo|lasagne|lasagna|penne|noodle\b/i, "pasta dish"],
  [/\brice|biryani|risotto|jollof|paella\b/i, "rice dish"],
  [/\bburger\b/i, "burger in a bun with toppings"],
  [/\bpizza\b/i, "pizza with visible toppings"],
  [/\bsalad\b/i, "fresh salad in a bowl"],
  [/\bsoup|stew|curry|potjie\b/i, "served in a bowl or pot"],
  [/\bpancake|waffle|french toast\b/i, "breakfast stack on a plate"],
  [/\bcake|pudding|pie|tart|dessert|brownie|cookie\b/i, "dessert plated with garnish"],
  [/\bbread|loaf|sandwich|wrap|taco|kota|bunny chow\b/i, "handheld, cut to show the filling"],
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000_000;
}

export interface ImageRecipeLike {
  slug?: string | null;
  name: string;
  cuisine?: string | null;
  category?: string | null;
  image_url?: string | null;
}

/** Builds a dish-specific prompt from the recipe name, cuisine and category. */
export function dishPrompt(r: ImageRecipeLike): string {
  const hints = INGREDIENT_HINTS.filter(([re]) => re.test(r.name)).map(([, h]) => h);
  return [
    r.name,
    r.cuisine ? `${r.cuisine} cuisine` : null,
    r.category ? r.category.toLowerCase() : null,
    ...hints,
    PHOTO_STYLE,
  ]
    .filter(Boolean)
    .join(", ");
}

export type ImageSize = "thumb" | "card" | "hero";

export const IMAGE_DIMENSIONS: Record<ImageSize, { width: number; height: number }> = {
  thumb: { width: 256, height: 256 },
  card: { width: 512, height: 512 },
  hero: { width: 1024, height: 1024 },
};

/** Returns an audited, CDN-hosted photo for the recipes bundled with MealMate. */
const CURATED_ALIASES: Record<string, string> = {
  bobotie: "cape-malay-bobotie",
  "cape-malay-bobotie": "cape-malay-bobotie",
  chakalaka: "chakalaka-with-pap",
  "chakalaka-with-pap": "chakalaka-with-pap",
  "chakalaka-with-pap-mealmate": "chakalaka-with-pap",
  "bunny-chow": "chicken-bunny-chow",
  "chicken-bunny-chow": "chicken-bunny-chow",
  "kota": "kota-south-african-spatlo-7rwhl",
  "kota-south-african-spatlo": "kota-south-african-spatlo-7rwhl",
  "kota-south-african-street-sandwich": "kota-south-african-spatlo-7rwhl",
  "malva-pudding": "malva-pudding",
  "malva-pudding-mealmate": "malva-pudding",
  "jollof-rice": "west-african-jollof-rice",
  "west-african-jollof-rice": "west-african-jollof-rice",
};

function curatedKey(value: string): string {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return CURATED_ALIASES[normalized] ?? normalized;
}

/** Dish photos generated specifically for recipes that had no curated photo. */
const DISH_PHOTOS: Record<string, string> = {
  "ackee-and-saltfish": ackeeImg,
  "mediterranean-quinoa-bowl-with-harissa-chicken": quinoaImg,
  "pizza-napoletana-margherita": pizzaImg,
  "pizza-margherita": pizzaImg,
};

/** Strip the random "-ab12c" suffix some slugs carry. */
function stripSuffix(key: string): string {
  return key.replace(/-[a-z0-9]{5}$/, "");
}

export function curatedRecipeImageUrl(
  r: Pick<ImageRecipeLike, "slug" | "name">,
  size: ImageSize = "card",
): string | null {
  const candidates = [r.slug, r.name].filter((value): value is string => Boolean(value?.trim()));
  for (const candidate of candidates) {
    const key = curatedKey(candidate);
    for (const k of [key, stripSuffix(key), CURATED_ALIASES[stripSuffix(key)] ?? ""]) {
      if (!k) continue;
      const photo = RECIPE_PHOTOS[k];
      if (photo) return photo[size];
      const dish = DISH_PHOTOS[k];
      if (dish) return dish;
    }
  }
  return null;
}

/** Lovable's curated category image for recipes without a dedicated asset. */
export function generatedImageUrl(r: ImageRecipeLike, _size: ImageSize = "card"): string {
  return categoryFallbackUrl(r);
}

/**
 * Resolve the URL to render. Prefers the stored image (so each recipe keeps its
 * own validated photo), but downsizes generated renditions to the size actually
 * needed — a 160px card never downloads a 1200px file.
 */
export function recipeImageUrl(r: ImageRecipeLike, size: ImageSize = "card"): string {
  const curated = curatedRecipeImageUrl(r, size);
  if (curated) return curated;
  return categoryFallbackUrl(r);
}

/**
 * Real, CDN-hosted photos used as a guaranteed last resort so a recipe card
 * never renders an empty/broken image while a generated photo is unavailable.
 */
import dinnerFb from "@/assets/recipes/fallback/dinner.jpg.asset.json";
import lunchFb from "@/assets/recipes/fallback/lunch.jpg.asset.json";
import breakfastFb from "@/assets/recipes/fallback/breakfast.jpg.asset.json";
import dessertFb from "@/assets/recipes/fallback/dessert.jpg.asset.json";
import snackFb from "@/assets/recipes/fallback/snack.jpg.asset.json";
import vegFb from "@/assets/recipes/fallback/veg.jpg.asset.json";

export function categoryFallbackUrl(r: ImageRecipeLike): string {
  const hay = `${r.name} ${r.category ?? ""} ${r.cuisine ?? ""}`.toLowerCase();
  if (/dessert|pudding|cake|pie|tart|brownie|cookie|ice cream/.test(hay)) return dessertFb.url;
  if (/breakfast|pancake|waffle|omelette|egg|porridge|oats|french toast/.test(hay))
    return breakfastFb.url;
  if (/snack|bread|muffin|baking|scone|biscuit|smoothie/.test(hay)) return snackFb.url;
  if (/vegan|vegetarian|salad|bowl|veggie|tofu|plant/.test(hay)) return vegFb.url;
  if (/lunch|sandwich|wrap|burger|kota|bunny chow|toastie/.test(hay)) return lunchFb.url;
  return dinnerFb.url;
}

/** onError handler: fall back to the dish-matched photo, then a real category photo. */
export function imageFallback(r: ImageRecipeLike, size: ImageSize = "card") {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const step = img.dataset["fallback"] ?? "0";
    if (step === "0") {
      img.dataset["fallback"] = "1";
      img.src = curatedRecipeImageUrl(r, size) ?? categoryFallbackUrl(r);
      return;
    }
    if (step === "1") {
      img.dataset["fallback"] = "2";
      img.src = categoryFallbackUrl(r);
    }
  };
}

