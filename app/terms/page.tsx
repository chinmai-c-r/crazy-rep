import Link from "next/link";
import LegalPage, { ContactEmails } from "@/components/LegalPage";

export const metadata = { title: "Terms of use | Crazy Rep" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="November 8, 2026">
      <p>
        These terms apply when you use Crazy Rep, an app for logging meals, activity, weight and water, with an AI coach. Crazy Rep is
        run by Chinmai CR (&quot;we&quot;, &quot;us&quot;). By creating an account or using the app you agree to these terms. If you do
        not agree, please do not use it.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be at least 16 years old. Crazy Rep is in early access, so we may limit who can create an account or sign in.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give us accurate details and keep your password safe. You are responsible for what happens under your account.</li>
        <li>Tell us if you think someone else has used your account.</li>
        <li>Please do not share your account or create accounts for other people.</li>
      </ul>

      <h2>What Crazy Rep does</h2>
      <p>
        You can log meals by photo or by name and get estimated calories and nutrients. You can also track activity, weight and water,
        search the meals you have eaten, set meal reminders, and ask an AI coach questions about your own logs. If you choose, meals you
        log can be added to Google Health.
      </p>

      <h2>Not medical advice</h2>
      <ul>
        <li>Nutrition values and the coach&apos;s answers are AI estimates. They can be wrong.</li>
        <li>Crazy Rep is not a medical device and does not give medical, dietary or other professional advice.</li>
        <li>
          If you have a medical condition, are pregnant, take medication, or have a history of disordered eating, talk to a health
          professional before changing how you eat or exercise.
        </li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>Your meals, photos, logs and chats are yours.</li>
        <li>
          You give us permission to store and process them to run the app for you, including sending them to the services described in
          the <Link href="/privacy">privacy policy</Link>.
        </li>
        <li>Only upload photos and text you have the right to use. Meal photos should be of food.</li>
      </ul>

      <h2>Using it fairly</h2>
      <p>Please do not:</p>
      <ul>
        <li>use the app for anything unlawful, or to harm or harass anyone;</li>
        <li>try to break, overload or get around the app&apos;s security or its limits, including the daily limits on AI use;</li>
        <li>use bots, scraping or other automated tools to access the app;</li>
        <li>copy, resell or reverse engineer the app, except where the law allows it.</li>
      </ul>

      <h2>Other services</h2>
      <p>
        Crazy Rep relies on other services, including Google (Gemini, and Google Health if you connect it), the USDA FoodData Central
        database, Supabase and Vercel. Their own terms apply to their services, and they may be unavailable or change.
      </p>

      <h2>Notifications</h2>
      <p>
        Meal reminders are optional. You can turn them off at any time in <b>Profile</b>, or in your phone or browser settings. They may
        arrive a little late.
      </p>

      <h2>Free early access and changes</h2>
      <p>
        Crazy Rep is free while it is in early access. We may change, pause or stop features, or put limits on use, at any time. We will
        try to give notice of big changes.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Crazy Rep and delete your account and all its data at any time from <b>Profile → Delete account</b>. We may
        suspend or end an account that breaks these terms or puts the app or other people at risk.
      </p>

      <h2>No warranty</h2>
      <p>
        Crazy Rep is provided &quot;as is&quot; and &quot;as available&quot;. We do not promise that it will always work, be free of
        errors, or that estimates are accurate.
      </p>

      <h2>Limit of liability</h2>
      <p>
        To the extent the law allows, we are not responsible for indirect or consequential losses, or for decisions you make based on
        the app&apos;s estimates or the coach&apos;s answers. Nothing in these terms limits any right or liability that the law does not
        allow to be limited.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top shows when they last changed. If you keep using Crazy Rep after a change, you agree
        to the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email <ContactEmails />.
      </p>
    </LegalPage>
  );
}
