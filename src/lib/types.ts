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
  source_type: "seed" | "manual" | "youtube" | "xiaohongshu";
  source_url: string | null;
  created_at: string;
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
    };
  };
};
