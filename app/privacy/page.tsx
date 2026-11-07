import LegalPage, { ContactEmails } from "@/components/LegalPage";

export const metadata = { title: "Privacy policy | Crazy Rep" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 8, 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your email address and display name.</li>
        <li>Profile data you choose to enter: sex, age, height, weight, activity level and nutrition goals.</li>
        <li>Activity, weight, body fat and water logs you add, and your conversations with the coach.</li>
        <li>Meal photos you upload and the nutrition estimates generated for them.</li>
        <li>
          If you turn on meal reminders: an address for notifications that your browser or phone gives us, the times you choose
          and your timezone.
        </li>
        <li>If you sign in with Google: the email address and name Google shares with us. We do not receive your Google password.</li>
        <li>If you connect Google Health: a token that lets Crazy Rep add your logged meals to it and, if you allow it, read your daily step counts (see below).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To estimate calories and nutrients, photos and any meal details you type are sent to Google&apos;s Gemini API for analysis. On Gemini&apos;s free tier, Google may use this content to improve its products.</li>
        <li>To show your daily totals, history and personalised targets.</li>
        <li>
          When you log a meal without a photo, the meal name and portion may be looked up in the USDA FoodData Central database.
          Results are saved without any account details so the same meal loads faster next time. When the AI analyses a meal, the
          individual foods it finds (names, portions and nutrition values, never your photo or account details) are saved the same
          way, so adding the same food later is quicker.
        </li>
        <li>
          To let you search the meals you have eaten, the names of your dishes and of the items in them are turned into numeric
          &quot;vectors&quot; by Google&apos;s Gemini embedding service. The vectors are stored by name only, not linked to your account,
          and are only ever compared with your own dishes.
        </li>
        <li>
          When you chat with the coach, your message and the parts of your logs needed to answer it are sent to Google&apos;s Gemini
          API. Chat history is stored in your account and you can clear it at any time.
        </li>
        <li>We do not sell your data or use it for advertising.</li>
      </ul>

      <h2>Google sign-in and Google Health</h2>
      <p>
        <b>Continue with Google.</b> If you choose it, Google tells us your email address and name so we can create or find your
        account. That is all we use it for.
      </p>
      <p>
        <b>Google Health (optional).</b> If you choose to connect it, Crazy Rep asks for up to four permissions. The first writes
        nutrition data (<code>https://www.googleapis.com/auth/googlehealth.nutrition.writeonly</code>). We use it only to add the
        meals you log (name, time, calories and nutrients) to your Google Health account, and to update or remove an entry when you
        edit or delete that meal. The second reads only Google&apos;s list of food serving units
        (<code>https://www.googleapis.com/auth/googlehealth.nutrition.readonly</code>), which Google requires on every nutrition
        entry. We do not read back the meals stored in your Google Health account. The third reads your sleep data
        (<code>https://www.googleapis.com/auth/googlehealth.sleep.readonly</code>): when each sleep session started and ended, how long
        you slept and how long you spent in each stage. We use it only to show your sleep in the app. The fourth reads your activity and fitness data
        (<code>https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly</code>). We use it only to read your
        daily step totals, the energy you burn each day, and your recorded workouts (type, time, duration, calories, distance and steps) and show them in your
        activity log. We store one step count per day one entry per workout and one entry per sleep session, visible only to you, and do not read anything
        else from Google Health, share it, or use it for advertising. If you ask the in-app coach a question, the coach can look at your steps and sleep to answer it; that data is sent to Google&apos;s Gemini AI service only to produce that answer. Disconnecting deletes the stored step counts, sleep sessions and imported workouts. The
        access token is kept on our server, never in your browser. You can disconnect at any time in <b>Profile</b>, which stops all
        syncing, and you can also remove access in your Google Account.
      </p>
      <p>
        Crazy Rep&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Data is stored in Supabase (PostgreSQL and private file storage) with row-level security, so only you can
        access your meals and photos. The app is hosted on Vercel.
      </p>
      <p>
        To work without a connection, the app keeps a copy of recently viewed data (such as today&apos;s meals and your profile) and your
        theme choice in your browser&apos;s storage on your device. Signing out clears it.
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
        Questions? Email <ContactEmails />.
      </p>
    </LegalPage>
  );
}
