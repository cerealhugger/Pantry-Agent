// Shared visual language: a fitting emoji per food item, so inventory / scan /
// recipes all look consistent. Falls back to a category emoji, then a cart.

export function foodEmoji(name: string, category: string | null): string {
  const n = (name ?? "").toLowerCase();
  const map: [string, string][] = [
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
  for (const [k, e] of map) if (n.includes(k)) return e;

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
    default: return "🛒";
  }
}
