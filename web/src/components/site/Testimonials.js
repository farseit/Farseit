// Sample placeholder testimonials — swap these for real client quotes once you have them.
const testimonials = [
  {
    quote:
      "Our old checkout process lost customers at the last step. FarseIT rebuilt it and our completion rate finally looks the way it should.",
    name: "Retail founder",
    role: "E-commerce client",
  },
  {
    quote:
      "Attendance and results used to live in three different spreadsheets. Now our whole staff works from one dashboard.",
    name: "School administrator",
    role: "Education client",
  },
  {
    quote:
      "They asked about our actual approval process before writing a line of code. That's rarer than it should be.",
    name: "Operations lead",
    role: "Private company client",
  },
];

export default function Testimonials() {
  return (
    <section className="section-pad bg-paper">
      <div className="container-x">
        <div className="max-w-xl">
          <span className="eyebrow">Client feedback</span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            What clients say after launch
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="f-card flex flex-col">
              <blockquote className="flex-1 text-slate">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 border-t border-line pt-4">
                <div className="font-display text-sm font-semibold text-ink">
                  {t.name}
                </div>
                <div className="text-xs text-slate">{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
