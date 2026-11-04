const services = [
  {
    title: "E-commerce platforms",
    color: "signal",
    desc: "Storefronts built around checkout speed and trust — secure payments, inventory that stays accurate, and a shopping flow customers don't abandon.",
  },
  {
    title: "School management systems",
    color: "brand",
    desc: "Admissions, attendance, results, and parent communication in one dashboard — built to cut administrative hours, not add to them.",
  },
  {
    title: "Private company operations",
    color: "brand",
    desc: "Internal tools that replace spreadsheets and back-and-forth email — approvals, reporting, and records your team can actually rely on.",
  },
  {
    title: "Custom web platforms",
    color: "signal",
    desc: "When off-the-shelf doesn't fit, we design and build the platform from scratch — scoped to your workflow, not a generic template.",
  },
];

const dot = {
  signal: "bg-signal",
  brand: "bg-brand",
};

export default function Services() {
  return (
    <section id="services" className="section-pad bg-paper">
      <div className="container-x">
        <div className="max-w-xl">
          <span className="eyebrow">What we build</span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Four specialisms, one connected process
          </h2>
          <p className="mt-4 leading-relaxed text-slate">
            Different projects, same discipline: understand the operation
            first, then build the platform that fits it.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 md:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="f-card">
              <span className={`inline-block h-3 w-3 rounded-full ${dot[s.color]}`} />
              <h3 className="mt-5 font-display text-xl font-semibold text-ink">
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-slate">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
