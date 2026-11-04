const points = [
  {
    title: "Tailored, not templated",
    desc: "We scope every build around your actual workflow instead of forcing your business into a generic package.",
  },
  {
    title: "Security by default",
    desc: "Encrypted data, secure payment gateways, and sensible access controls are part of the build, not an add-on.",
  },
  {
    title: "Built to grow",
    desc: "From your first hundred users to your first hundred thousand, the architecture is chosen to scale with you.",
  },
  {
    title: "Clear communication",
    desc: "You'll always know what's being built, what's next, and when to expect it — no disappearing between milestones.",
  },
];

export default function WhyUs() {
  return (
    <section id="work" className="section-pad bg-fsurface">
      <div className="container-x">
        <div className="max-w-xl">
          <span className="eyebrow">Why work with FarseIT</span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Built on trust, delivered with discipline
          </h2>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {points.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="mt-1 h-2 w-2 flex-none rounded-full bg-brand" />
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {p.title}
                </h3>
                <p className="mt-2 leading-relaxed text-slate">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
