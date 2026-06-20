import Link from "next/link";

const actions = [
  { href: "/scan", emoji: "📸", title: "Scan receipt", desc: "Add groceries fast", tint: "bg-brand-soft" },
  { href: "/inventory", emoji: "🧊", title: "My pantry", desc: "Sorted by expiry", tint: "bg-amber/20" },
  { href: "/planner", emoji: "📅", title: "Meal plan", desc: "Plan the week", tint: "bg-coral/15" },
  { href: "/import", emoji: "📥", title: "Import a recipe", desc: "Paste any link", tint: "bg-brand-soft" },
];

function Step({ e, l }: { e: string; l: string }) {
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-base">{e}</span>
      {l}
    </span>
  );
}

export default function Home() {
  return (
    <div className="px-5 pt-5">
      <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-tight text-ink">
        Cook what you
        <br />
        <span className="text-brand">already have.</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Turn the groceries in your kitchen — and the recipes you trust — into low-waste meals.
      </p>

      {/* mission / social-impact card */}
      <div
        style={{ background: "linear-gradient(135deg, #1f9d6b 0%, #16704a 100%)" }}
        className="relative mt-5 overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-black/10"
      >
        <div className="pointer-events-none absolute -right-5 -top-7 select-none text-[120px] leading-none opacity-15">
          🌍
        </div>
        <p className="relative text-[11px] font-bold uppercase tracking-wider text-white/75">Why it matters</p>
        <p className="relative mt-1.5 text-[15px] font-medium leading-snug">
          A third of all food produced gets wasted. PantryAgent helps your household eat what it
          already bought — saving money and cutting waste.
        </p>
        <Link
          href="/import"
          className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-dark transition active:scale-95"
        >
          Import a recipe →
        </Link>
      </div>

      {/* quick actions */}
      <h2 className="mb-3 mt-7 text-sm font-bold text-ink/70">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="card p-4 transition active:scale-[0.98]">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${a.tint}`}>
              {a.emoji}
            </div>
            <p className="mt-2.5 text-[15px] font-bold text-ink">{a.title}</p>
            <p className="mt-0.5 text-xs text-muted">{a.desc}</p>
          </Link>
        ))}
      </div>

      {/* the loop */}
      <h2 className="mb-3 mt-7 text-sm font-bold text-ink/70">How the loop works</h2>
      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-4 text-[11px] font-semibold text-brand-dark shadow-sm">
        <Step e="🧾" l="Inventory" />
        <span className="text-brand/30">→</span>
        <Step e="🍳" l="Recipe" />
        <span className="text-brand/30">→</span>
        <Step e="✅" l="Record" />
        <span className="text-brand/30">→</span>
        <Step e="🛒" l="Shop" />
      </div>
    </div>
  );
}
