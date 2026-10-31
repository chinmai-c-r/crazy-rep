import { Logo } from "@/components/Logo";

export const metadata = { title: "Privacy policy — Crazy Rep" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-5 pt-10 pb-20 text-muted-foreground [&_b]:text-foreground [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:tracking-wide [&_h2]:text-foreground [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-6">
      <Logo />
      <h1 className="mt-6 font-heading text-5xl tracking-wide text-foreground">Privacy policy</h1>
      <p>Last updated: October 31, 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your email address and display name.</li>
        <li>Profile data you choose to enter: sex, age, height, weight, activity level and nutrition goals.</li>
        <li>Activity, weight, body fat and water logs you add, and your conversations with the coach.</li>
        <li>Meal photos you upload and the nutrition estimates generated for them.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To estimate calories and nutrients, photos and any meal details you type are sent to Google&apos;s Gemini API for analysis. On Gemini&apos;s free tier, Google may use this content to improve its products.</li>
        <li>To show your daily totals, history and personalised targets.</li>
        <li>
          When you log a meal without a photo, the meal name and portion may be looked up in the USDA FoodData Central database.
          Results are saved without any account details so the same meal loads faster next time.
        </li>
        <li>
          When you chat with the coach, your message and the parts of your logs needed to answer it are sent to Google&apos;s Gemini
          API. Chat history is stored in your account and you can clear it at any time.
        </li>
        <li>We do not sell your data or use it for advertising.</li>
      </ul>

      <h2>Where it is stored</h2>
      <p>
        Data is stored in Supabase (PostgreSQL and private file storage) with row-level security, so only you can
        access your meals and photos. The app is hosted on Vercel.
      </p>

      <h2>Your choices</h2>
      <p>
        You can edit or delete any meal at any time. You can permanently delete your account and all associated
        data from <b>Profile → Delete account</b>. Deletion is immediate and cannot be undone.
      </p>

      <h2>Health disclaimer</h2>
      <p>
        Nutrition values are AI estimates from photos and may be inaccurate. Crazy Rep is not a medical device and
        does not provide medical advice.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href="mailto:chinmaicoder@gmail.com">chinmaicoder@gmail.com</a>.
      </p>
    </main>
  );
}
