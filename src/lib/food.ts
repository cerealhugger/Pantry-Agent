// Shared visual language: a fitting emoji per food item, so inventory / scan /
// recipes all look consistent.
//
// Two object kinds, two defaults (see CLAUDE.md icon-default rule):
//   • ingredient (pantry / shopping list / missing) → foodEmoji, default 🛒 (grocery)
//   • meal (recipe / meal-plan meal / recommendation) → mealEmoji, default 🍽️ (utensil)

const INGREDIENT_MAP: [string, string][] = [
  ["spinach", "🥬"], ["lettuce", "🥬"], ["kale", "🥬"], ["cabbage", "🥬"],
  ["broccoli", "🥦"], ["tomato", "🍅"], ["potato", "🥔"], ["carrot", "🥕"],
  ["onion", "🧅"], ["garlic", "🧄"], ["pepper", "🫑"], ["chili", "🌶️"],
  ["cucumber", "🥒"], ["corn", "🌽"], ["mushroom", "🍄"], ["avocado", "🥑"],
  ["eggplant", "🍆"],
  ["apple", "🍎"], ["banana", "🍌"], ["orange", "🍊"], ["lemon", "🍋"],
  ["strawberr", "🍓"], ["grape", "🍇"], ["berr", "🫐"], ["peach", "🍑"],
  ["mango", "🥭"], ["melon", "🍉"],
  ["beef", "🥩"], ["steak", "🥩"], ["pork", "🥓"], ["bacon", "🥓"],
  ["chicken", "🍗"], ["turkey", "🍗"], ["fish", "🐟"], ["salmon", "🐟"],
  ["tuna", "🐟"], ["shrimp", "🦐"], ["prawn", "🦐"],
  ["egg", "🥚"], ["milk", "🥛"], ["cream", "🥛"], ["yogurt", "🥛"],
  ["cheese", "🧀"], ["butter", "🧈"],
  ["bread", "🍞"], ["bagel", "🥯"], ["rice", "🍚"], ["pasta", "🍝"],
  ["noodle", "🍜"], ["flour", "🌾"], ["oat", "🌾"],
  ["olive oil", "🫒"], ["oil", "🫙"], ["salt", "🧂"], ["sugar", "🍬"],
  ["honey", "🍯"], ["sauce", "🥫"], ["bean", "🫘"], ["tofu", "🧊"],
  ["coffee", "☕"], ["tea", "🍵"], ["juice", "🧃"], ["wine", "🍷"], ["beer", "🍺"],
];

// Dish-shaped names get a plated icon first; otherwise fall back to ingredient terms.
const DISH_MAP: [string, string][] = [
  ["salad", "🥗"], ["soup", "🍲"], ["noodle", "🍜"], ["pasta", "🍝"],
  ["rice", "🍚"], ["sushi", "🍣"], ["taco", "🌮"], ["burrito", "🌯"],
  ["pizza", "🍕"], ["burger", "🍔"], ["sandwich", "🥪"], ["omelet", "🍳"],
  ["chicken", "🍗"], ["steak", "🥩"], ["beef", "🥩"], ["pork", "🥓"],
  ["fish", "🐟"], ["salmon", "🐟"], ["shrimp", "🦐"], ["curry", "🍛"],
  ["pancake", "🥞"], ["bread", "🍞"], ["cake", "🍰"], ["smoothie", "🥤"],
  ["stir", "🥘"], ["fry", "🍳"], ["bowl", "🥣"], ["wrap", "🌯"], ["egg", "🍳"],
];

export function foodEmoji(name: string, category: string | null): string {
  const n = (name ?? "").toLowerCase();
  for (const [k, e] of INGREDIENT_MAP) if (n.includes(k)) return e;

  switch ((category ?? "").toLowerCase()) {
    case "vegetable": return "🥬";
    case "fruit": return "🍎";
    case "meat": return "🥩";
    case "seafood": return "🦐";
    case "dairy": return "🥛";
    case "bakery":
    case "grain": return "🍞";
    case "pantry": return "🫙";
    case "frozen": return "🧊";
    case "beverage": return "🧃";
    default: return "🛒"; // ingredient default: grocery
  }
}

// Icon for a meal/recipe. Tries dish names, then ingredient names; if nothing
// matches, falls back to a utensil (the meal default).
export function mealEmoji(title: string): string {
  const n = (title ?? "").toLowerCase();
  for (const [k, e] of DISH_MAP) if (n.includes(k)) return e;
  for (const [k, e] of INGREDIENT_MAP) if (n.includes(k)) return e;
  return "🍽️"; // meal default: utensil
}
