"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/inventory", label: "Pantry" },
  { href: "/recipes",   label: "Recipes" },
  { href: "/scan",      label: "Scan" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="max-w-2xl mx-auto px-4 flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-gray-900 mr-2">🥦 PantryPilot</Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium transition-colors ${
              path.startsWith(l.href)
                ? "text-gray-900 border-b-2 border-gray-900 pb-0.5"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
