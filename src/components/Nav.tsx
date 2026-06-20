"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px]"
    >
      {children}
    </svg>
  );
}

const HomeIcon = () => (
  <Svg>
    <path d="M3 10.8 12 4l9 6.8" />
    <path d="M5.5 9.5V20h13V9.5" />
  </Svg>
);
const FridgeIcon = () => (
  <Svg>
    <path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M5.5 10.5h13" />
    <path d="M8.5 6.5v2" />
    <path d="M8.5 13v3" />
  </Svg>
);
const CameraIcon = () => (
  <Svg>
    <path d="M4.5 8.5A1.5 1.5 0 0 1 6 7h1.8L9 5.2h6L16.2 7H18a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 18H6a1.5 1.5 0 0 1-1.5-1.5z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
const BookIcon = () => (
  <Svg>
    <path d="M12 6.4C10.4 5.4 7.8 5 4.5 5.2v12.4c3.3-.2 5.9.2 7.5 1.2 1.6-1 4.2-1.4 7.5-1.2V5.2C16.2 5 13.6 5.4 12 6.4Z" />
    <path d="M12 6.4v12.6" />
  </Svg>
);
const CalendarIcon = () => (
  <Svg>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3.5v3" />
    <path d="M16 3.5v3" />
    <path d="M7.5 13h3v3h-3z" />
  </Svg>
);

const items = [
  { href: "/", label: "Home", icon: <HomeIcon />, exact: true },
  { href: "/inventory", label: "Pantry", icon: <FridgeIcon /> },
  { href: "/scan", label: "Scan", fab: true },
  { href: "/recipes", label: "Recipes", icon: <BookIcon /> },
  { href: "/planner", label: "Planner", icon: <CalendarIcon /> },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[440px] -translate-x-1/2 border-t border-black/[0.06] bg-cream/90 backdrop-blur-md">
      <ul className="flex items-end justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map((it) => {
          const active = it.exact ? path === it.href : path.startsWith(it.href);
          if (it.fab) {
            return (
              <li key={it.href} className="flex flex-1 flex-col items-center">
                <Link
                  href={it.href}
                  aria-label={it.label}
                  className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 ring-4 ring-cream transition active:scale-95"
                >
                  <CameraIcon />
                </Link>
                <span className="mt-1 text-[10px] font-semibold text-brand">{it.label}</span>
              </li>
            );
          }
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold transition-colors ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                {it.icon}
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
