"use client";

import { useState } from "react";

const stack = {
  Frontend: ["React", "Next.js", "Tailwind CSS", "TypeScript"],
  Backend: ["Node.js", "Express", "REST & GraphQL APIs", "Prisma"],
  Database: ["PostgreSQL", "MongoDB", "Redis", "Supabase"],
  CMS: ["WordPress", "Strapi", "Sanity", "Shopify"],
  Tools: ["Git & GitHub", "Docker", "Figma", "Vercel"],
};

const tabs = Object.keys(stack);

export default function TechStack() {
  const [active, setActive] = useState(tabs[0]);

  return (
    <section className="section-pad bg-ink">
      <div className="container-x">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="eyebrow text-signal">Under the hood</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-paper">
              A stack chosen for speed and longevity
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  active === tab
                    ? "bg-brand text-paper"
                    : "bg-white/5 text-paper/70 hover:bg-white/10"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stack[active].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-4 font-mono text-sm text-paper/90"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
