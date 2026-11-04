export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden border-b border-line bg-paper">
      <div className="absolute inset-0 bg-grid-pattern bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />

      <div className="container-x section-pad relative grid gap-14 md:grid-cols-2 md:items-center">
        <div>
          <span className="eyebrow">Web &amp; platform engineering</span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            We connect the dots between your business and a platform built to last.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-slate">
            FarseIT designs and builds e-commerce stores, school management
            systems, and internal tools for private companies — on modern,
            dependable technology, with a client-centric process from the
            first sketch to launch day.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#contact" className="f-btn-accent">
              Get a free consultation
            </a>
            <a href="#farse-ai" className="f-btn-secondary">
              Meet Farse AI chatbot
            </a>
          </div>

          <dl className="mt-14 flex gap-10 border-t border-line pt-8">
            <div>
              <dt className="font-display text-2xl font-semibold text-ink">1+</dt>
              <dd className="mt-1 text-sm text-slate">Years shipping products</dd>
            </div>
            <div>
              <dt className="font-display text-2xl font-semibold text-ink">9+</dt>
              <dd className="mt-1 text-sm text-slate">Projects delivered</dd>
            </div>
            <div>
              <dt className="font-display text-2xl font-semibold text-ink">3</dt>
              <dd className="mt-1 text-sm text-slate">Core specialisms</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md">
          <ConnectionGraphic />
        </div>
      </div>
    </section>
  );
}

function ConnectionGraphic() {
  const nodes = [
    { x: 200, y: 60, r: 9, color: "signal" },
    { x: 70, y: 150, r: 7, color: "brand" },
    { x: 330, y: 150, r: 7, color: "brand" },
    { x: 140, y: 250, r: 6, color: "ink" },
    { x: 260, y: 250, r: 6, color: "ink" },
    { x: 200, y: 340, r: 9, color: "signal" },
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 5],
    [1, 4],
    [2, 3],
  ];
  const colorMap = {
    signal: "#FF6A1A",
    brand: "#1657FF",
    ink: "#0B0E14",
  };

  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#0B0E14"
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={colorMap[n.color]} />
      ))}
    </svg>
  );
}
