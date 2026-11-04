"use client";

import { useState } from "react";

export default function Contact() {
  const [status, setStatus] = useState("idle");

  function handleSubmit(e) {
    e.preventDefault();
    // Wire this up to your email service or API route of choice.
    setStatus("sent");
  }

  return (
    <section id="contact" className="section-pad bg-ink text-paper">
      <div className="container-x grid gap-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <span className="eyebrow text-signal">Get in touch</span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            Tell us what you&apos;re building
          </h2>
          <p className="mt-4 max-w-sm leading-relaxed text-paper/70">
            Share a few details about your project and we&apos;ll get back to
            you with next steps within one business day.
          </p>

          <div className="mt-10 space-y-4 text-sm">
            <div>
              <div className="text-paper/50">Email</div>
              <a href="mailto:info@farseit.com" className="font-medium hover:text-signal">
                info@farseit.com
              </a>
            </div>
            <div>
              <div className="text-paper/50">Phone</div>
              <a href="tel:+8801761402081" className="font-medium hover:text-signal">
                01761402081
              </a>
            </div>
            <div>
              <div className="text-paper/50">Social</div>
              <div className="mt-1 flex gap-4 font-medium">
                <a href="#" className="hover:text-signal">Facebook</a>
                <a href="#" className="hover:text-signal">Twitter</a>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="md:col-span-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-paper/70">Name</span>
              <input
                required
                type="text"
                name="name"
                placeholder="Your name"
                className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm text-paper placeholder:text-paper/40 focus:border-brand focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-paper/70">Email</span>
              <input
                required
                type="email"
                name="email"
                placeholder="you@company.com"
                className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm text-paper placeholder:text-paper/40 focus:border-brand focus:outline-none"
              />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="text-sm text-paper/70">Message</span>
            <textarea
              required
              name="message"
              rows={5}
              placeholder="What are you looking to build?"
              className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm text-paper placeholder:text-paper/40 focus:border-brand focus:outline-none"
            />
          </label>

          <button type="submit" className="f-btn-accent mt-6 w-full sm:w-auto">
            Send message
          </button>

          {status === "sent" && (
            <p className="mt-4 text-sm text-signal" role="status">
              Thanks — your message is in. We&apos;ll reply within one business day.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
