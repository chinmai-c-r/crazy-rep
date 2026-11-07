import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CONTACT_EMAILS } from "@/lib/contact";

/** The two ways to reach us, as links, for the Contact section of a legal page. */
export function ContactEmails() {
  return (
    <>
      {CONTACT_EMAILS.map((email, i) => (
        <span key={email}>
          {i > 0 && " or "}
          <a href={`mailto:${email}`}>{email}</a>
        </span>
      ))}
    </>
  );
}

/** The shared look of the privacy policy and the terms of use. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-5 pt-10 pb-20 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_b]:text-foreground [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:tracking-wide [&_h2]:text-foreground [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-6">
      <Logo />
      <h1 className="mt-6 font-heading text-5xl tracking-wide text-foreground">{title}</h1>
      <p>Last updated: {updated}</p>
      {children}
      <nav aria-label="Legal" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of use</Link>
        <Link href="/">Home</Link>
      </nav>
    </main>
  );
}
