import Link from "next/link";

const features = [
  {
    title: "Replies on Messenger 24/7",
    desc: "The AI answers product questions, prices and delivery in Bangla or English, in your shop's own tone.",
  },
  {
    title: "Takes orders in the chat",
    desc: "Collects name, phone and address, calculates delivery, and drops a ready order into your dashboard.",
  },
  {
    title: "Your inbox, your control",
    desc: "Step in any time. When you reply yourself, the bot pauses so customers never get double answers.",
  },
  {
    title: "Product catalog & landing pages",
    desc: "Add products with photos and options. Every product gets a shareable order page you can post on Facebook.",
  },
  {
    title: "Bring your own AI key",
    desc: "Connect your own Gemini key so the AI cost stays in your account, with live health checks.",
  },
  {
    title: "Simple monthly plans",
    desc: "Start with a free 7-day trial. Pay by bKash or Nagad and your plan is activated after approval.",
  },
];

const plans = [
  { name: "Trial", price: "Free", note: "7 days", replies: "150 AI replies", pages: "1 Page", products: "30 products" },
  { name: "Pro", price: "৳999", note: "per month", replies: "5,000 AI replies", pages: "1 Page", products: "1,000 products", featured: true },
];

export default function FarseAI() {
  return (
    <section id="farse-ai" className="section-pad border-y border-line bg-fsurface">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <span className="eyebrow">Our product</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Farse AI — an automatic sales assistant for your Facebook Page
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-slate">
              Create an account, connect your Page, add your products, and let the
              AI chat with customers and take orders while you focus on your
              business. No website needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 md:col-span-5 md:justify-end">
            <Link href="/shop/start" className="f-btn-accent">
              Create free account
            </Link>
            <Link href="/shop/start?mode=login" className="f-btn-secondary">
              Login to dashboard
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="f-card">
              <span className="inline-block h-3 w-3 rounded-full bg-signal" />
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">Pricing</h3>
          <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-xl border bg-paper p-6 ${p.featured ? "border-brand shadow-[0_20px_45px_-25px_rgba(22,87,255,0.45)]" : "border-line"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold text-ink">{p.name}</span>
                  {p.featured && <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">Popular</span>}
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-display text-3xl font-semibold text-ink">{p.price}</span>
                  <span className="pb-1 text-sm text-slate">{p.note}</span>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-slate">
                  <li>{p.replies}</li>
                  <li>{p.pages}</li>
                  <li>{p.products}</li>
                </ul>
                <Link href="/shop/start" className="f-btn-secondary mt-6 w-full">
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
