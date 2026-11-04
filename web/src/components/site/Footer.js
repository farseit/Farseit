const footerLinks = {
  Company: [
    { label: "About us", href: "#about" },
    { label: "Our work", href: "#work" },
    { label: "Testimonials", href: "#work" },
  ],
  Services: [
    { label: "E-commerce", href: "#services" },
    { label: "School management", href: "#services" },
    { label: "Company operations", href: "#services" },
    { label: "Farse AI chatbot", href: "#farse-ai" },
  ],
  Support: [
    { label: "Contact us", href: "#contact" },
    { label: "Login / Register", href: "/shop/start" },
    { label: "Terms & conditions", href: "/terms" },
    { label: "Privacy policy", href: "/privacy" },
    { label: "Data deletion", href: "/data-deletion" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-line bg-fsurface">
      <div className="container-x grid gap-10 py-16 md:grid-cols-12">
        <div className="md:col-span-4">
          <a href="#home" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink">
              <span className="h-2 w-2 rounded-full bg-signal" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Farse<span className="text-brand">IT</span>
            </span>
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate">
            Robust, sustainable web platforms for e-commerce, education, and
            private companies.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8">
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-display text-sm font-semibold text-ink">
                {title}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-slate transition-colors hover:text-ink"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-slate sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} FarseIT. All rights reserved.</span>
          <span>support@farseit.com · 01761402081</span>
        </div>
      </div>
    </footer>
  );
}
