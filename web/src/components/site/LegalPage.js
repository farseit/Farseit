import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";

export const CONTACT = {
  email: "support@farseit.com",
  phone: "01761402081",
  site: "https://farseit.vercel.app",
};

export default function LegalPage({ title, updated, children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-paper">
        <div className="container-x flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-14 w-auto" />
          </Link>
          <Link href="/shop/start" className="f-btn-accent">
            Try Farse AI free
          </Link>
        </div>
      </header>

      <main className="container-x flex-1 py-14">
        <article className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate">Last updated: {updated}</p>

          <div className="mt-8 text-[15px] text-slate [&_a]:text-brand [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-2 [&_li]:leading-relaxed [&_p]:mt-3 [&_p]:leading-relaxed [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-line bg-fsurface">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-slate sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} FarseIT. All rights reserved.</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
            <Link href="/data-deletion" className="hover:text-ink">Data Deletion</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}