"use client";
import { BrandLogo } from "@/components/BrandLogo";

import Link from "next/link";
import { useState } from "react";

const links = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Farse AI", href: "#farse-ai" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur">
      <div className="container-x flex h-20 items-center justify-between">
        <a href="#home" className="flex items-center gap-2">
          <BrandLogo className="h-14 w-auto" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/shop/start?mode=login" className="px-3 text-sm font-semibold text-ink hover:text-brand">
            Login
          </Link>
          <Link href="/shop/start" className="f-btn-accent">
            Try Farse AI free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line md:hidden"
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 h-0.5 w-5 bg-ink transition-transform ${
                open ? "top-2 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-2 h-0.5 w-5 bg-ink transition-opacity ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 h-0.5 w-5 bg-ink transition-transform ${
                open ? "top-2 -rotate-45" : "top-4"
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper md:hidden">
          <nav className="container-x flex flex-col gap-1 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-ink hover:bg-fsurface"
              >
                {link.label}
              </a>
            ))}
            <Link href="/shop/start?mode=login" onClick={() => setOpen(false)} className="f-btn-secondary mt-2 justify-center">
              Login
            </Link>
            <Link href="/shop/start" onClick={() => setOpen(false)} className="f-btn-accent justify-center">
              Try Farse AI free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
