"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { accessRequestSchema } from "@/lib/schemas";
import Reveal from "./Reveal";

type Input = z.input<typeof accessRequestSchema>;

export default function RequestAccess() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const { register, handleSubmit, formState, setValue } = useForm<Input, unknown, z.output<typeof accessRequestSchema>>({
    resolver: zodResolver(accessRequestSchema),
    defaultValues: { email: "", name: "", message: "", website: "" },
  });
  const { errors, isSubmitting } = formState;

  // Sent here from sign-up (or a blocked sign-in) with ?email=: fill it in and explain why
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (!email) return;
    setValue("email", email);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once on mount
    setInvited(email);
    document.getElementById("access")?.scrollIntoView({ behavior: "smooth" });
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await fetch("/api/access-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setServerError(json.error ?? "Something went wrong. Please try again.");
    setDone(true);
  });

  return (
    <section id="access" className="cta">
      <motion.div
        className="cta__orb"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
      />
      <Reveal>
        <h2>
          WANT <span className="accent">IN?</span>
        </h2>
        <p>Crazy Rep is in early access and free to use. Leave your email and we&apos;ll let you know when your account is ready.</p>
        {invited && !done && (
          <p className="access__notice" role="status">
            <b>{invited}</b> isn&apos;t on the access list yet. Request access below and we&apos;ll email you when you can sign up.
          </p>
        )}

        {done ? (
          <p className="cta__thanks" role="status">
            ✓ You&apos;re on the list. We&apos;ll email you soon.
          </p>
        ) : (
          <form className="access" onSubmit={onSubmit} noValidate>
            <div className="access__row">
              <label className="access__field">
                <span>Email</span>
                <input type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} {...register("email")} />
                {errors.email && <em role="alert">{errors.email.message}</em>}
              </label>
              <label className="access__field">
                <span>
                  Name <small>(optional)</small>
                </span>
                <input autoComplete="name" placeholder="Your name" aria-invalid={!!errors.name} {...register("name")} />
                {errors.name && <em role="alert">{errors.name.message}</em>}
              </label>
            </div>
            <label className="access__field">
              <span>
                What do you want to track? <small>(optional)</small>
              </span>
              <textarea rows={2} placeholder="e.g. Losing weight, eating more protein" aria-invalid={!!errors.message} {...register("message")} />
              {errors.message && <em role="alert">{errors.message.message}</em>}
            </label>
            {/* Honeypot: hidden from people */}
            <input className="access__hp" tabIndex={-1} autoComplete="off" aria-hidden {...register("website")} />
            {serverError && (
              <em className="access__error" role="alert">
                {serverError}
              </em>
            )}
            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Request access"}
            </button>
          </form>
        )}

        <div className="cta__stores">
          <span>📱 Install from your browser on Android and iPhone</span>
        </div>
      </Reveal>
    </section>
  );
}
