export default function About() {
  return (
    <section id="about" className="section-pad bg-fsurface">
      <div className="container-x grid gap-12 md:grid-cols-12 md:items-start">
        <div className="md:col-span-4">
          <span className="eyebrow">About FarseIT</span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            Websites that do more than look good.
          </h2>
        </div>

        <div className="md:col-span-8">
          <p className="text-lg leading-relaxed text-ink">
            FarseIT is a web development studio building for e-commerce,
            education, and private companies. We don&apos;t just design
            pages — we architect platforms that hold up under real traffic,
            real orders, and real operations.
          </p>
          <p className="mt-5 leading-relaxed text-slate">
            Every engagement starts with your workflow, not a template. From
            secure checkout flows to student attendance dashboards to
            internal tools that cut down manual work, we scope the build
            around what your team actually needs — then ship it on a stack
            that&apos;s easy to maintain long after launch.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {["Client-first process", "Modern, maintainable stack", "Built for scale"].map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-paper px-4 py-2 text-xs font-medium text-slate"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
