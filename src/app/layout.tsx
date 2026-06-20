import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Nav from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PantryAgent — cook what you have",
  description:
    "A waste-aware meal planning agent. Turn the groceries you already have — and the recipes you already trust — into low-waste meals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-cream-deep text-ink antialiased">
        <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-cream shadow-2xl shadow-black/10">
          <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-cream/85 px-5 py-3 backdrop-blur-md">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="PantryAgent" className="h-9 w-9" />
              <div className="leading-tight">
                <p className="text-[15px] font-bold tracking-tight">PantryAgent</p>
                <p className="text-[11px] font-semibold text-brand">Cook what you have · waste nothing</p>
              </div>
            </Link>
          </header>

          <div className="flex-1 pb-28">{children}</div>

          <Nav />
        </div>
      </body>
    </html>
  );
}
