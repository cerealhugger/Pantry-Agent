// ─── Row types (what the DB returns) ─────────────────────────────────────────

export type InventoryItem = {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  purchase_date: string;       // ISO date string
  expiry_date: string | null;  // ISO date string
  created_at: string;
};

export type Ingredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  raw: string | null;   // original ingredient line as written, e.g. "black pepper to taste"
};

export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  calories_per_serving: number | null;
  servings: number | null;
  tags: string[];
  source_type: "seed" | "manual" | "youtube" | "web_recipe" | "xiaohongshu";
  source_url: string | null;
  created_at: string;

  // Optional Browserbase / nutrition metadata (may be absent on older rows)
  extraction_confidence?: number | null;
  source_metadata?: { nutrition?: SavedNutrition; [key: string]: unknown } | null;
};

export type RecipeDraft = Omit<Recipe, "id" | "user_id" | "created_at">;

export type BrowserbaseActionLogEntry = {
  step: number;
  action: string;
  result: string;
};

export type BrowserbaseImportResult = {
  status: "succeeded" | "failed";
  inputUrl: string;
  importType: "recipe_url";
  extractionMode: "fetch" | "stagehand";
  browserbaseSessionId?: string;
  browserbaseReplayUrl?: string;
  browserbaseLiveUrl?: string;
  actionLog: BrowserbaseActionLogEntry[];
  recipe?: RecipeDraft;
  errorMessage?: string;
};

// ─── Nutrition verification (Browserbase Workflow D) ─────────────────────────

export type NutritionPer100g = {
  calories: number | null;   // kcal per 100g
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionEvidence = {
  ingredient: string;
  status: "verified" | "not_found";
  per100g: NutritionPer100g | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  confidence: "high" | "medium" | "low";
  extractionMode: "search+fetch" | "search" | "none";
  note?: string;
};

export type NutritionVerificationResult = {
  status: "succeeded" | "failed";
  recipeTitle: string;
  servings: number | null;
  aiCaloriesPerServing: number | null;        // the recipe's original AI estimate
  estimatedCaloriesPerServing: number | null; // reconciled from browser evidence
  overallConfidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: NutritionEvidence[];
  actionLog: BrowserbaseActionLogEntry[];
  errorMessage?: string;
};

// What we persist on a recipe row (recipes.source_metadata.nutrition)
export type SavedNutrition = {
  estimatedCaloriesPerServing: number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  evidence: NutritionEvidence[];
  verifiedAt: string;
};

export type WebImport = {
  id: string;
  user_id: string;
  input_url: string | null;
  input_query: string | null;
  import_type: "recipe_url" | "youtube" | "grocery_lookup" | "nutrition_lookup";
  status: "pending" | "running" | "succeeded" | "failed";
  browserbase_session_id: string | null;
  browserbase_replay_url: string | null;
  browserbase_live_url: string | null;
  extraction_mode: string | null;
  action_log: BrowserbaseActionLogEntry[];
  extracted_json: unknown;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DietLog = {
  id: string;
  user_id: string;
  log_date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack" | null;
  description: string | null;
  calories: number | null;
  source: "recipe" | "photo" | null;
  recipe_id: string | null;
  created_at: string;
};

export type MealPlan = {
  id: string;
  user_id: string;
  week_start: string;
  plan: MealPlanEntry[];
  created_at: string;
};

export type MealPlanEntry = {
  day: string;   // e.g. "Monday"
  meal: "breakfast" | "lunch" | "dinner";
  recipe_id: string;
};

export type ShoppingListItem = {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  created_at: string;
};

// ─── Supabase Database type (for createClient<Database>) ─────────────────────

export type Database = {
  public: {
    Tables: {
      inventory_items: {
        Row: InventoryItem;
        Insert: Omit<InventoryItem, "id" | "created_at">;
        Update: Partial<Omit<InventoryItem, "id" | "created_at">>;
      };
      recipes: {
        Row: Recipe;
        Insert: Omit<Recipe, "id" | "created_at">;
        Update: Partial<Omit<Recipe, "id" | "created_at">>;
      };
      diet_log: {
        Row: DietLog;
        Insert: Omit<DietLog, "id" | "created_at">;
        Update: Partial<Omit<DietLog, "id" | "created_at">>;
      };
      meal_plans: {
        Row: MealPlan;
        Insert: Omit<MealPlan, "id" | "created_at">;
        Update: Partial<Omit<MealPlan, "id" | "created_at">>;
      };
      shopping_list_items: {
        Row: ShoppingListItem;
        Insert: Omit<ShoppingListItem, "id" | "created_at">;
        Update: Partial<Omit<ShoppingListItem, "id" | "created_at">>;
      };
      web_imports: {
        Row: WebImport;
        Insert: Omit<WebImport, "id" | "created_at">;
        Update: Partial<Omit<WebImport, "id" | "created_at">>;
      };
    };
  };
};
