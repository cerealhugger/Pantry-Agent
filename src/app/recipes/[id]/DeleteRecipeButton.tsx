"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DeleteRecipeButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setDeleting(true);
    await supabase.from("recipes").delete().eq("id", id);
    router.push("/recipes");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete recipe"}
    </button>
  );
}
