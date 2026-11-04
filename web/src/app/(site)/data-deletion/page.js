import LegalPage, { CONTACT } from "@/components/site/LegalPage";

export const metadata = {
  title: "Data Deletion | FarseIT",
  description: "How to delete your data from Farse AI.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions" updated="November 4, 2026">
      <p>
        You can ask us to delete the data Farse AI holds about you at any time. Follow the option that
        matches you.
      </p>

      <h2>If you are a shop owner</h2>
      <ul>
        <li>
          <strong>Disconnect a Page:</strong> in your dashboard go to Facebook Page and choose
          Disconnect. This removes the stored Page token and stops the bot on that Page.
        </li>
        <li>
          <strong>Delete your account and all shop data:</strong> send an email to{" "}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> with the subject
          &quot;Data deletion request&quot;. Write your name, shop name and the mobile number used to
          register, and send it from your registered email if you have one. You can also call{" "}
          {CONTACT.phone}.
        </li>
        <li>
          <strong>Remove the app from Facebook:</strong> on Facebook go to Settings, then Business
          Integrations, find Farse AI and remove it. This revokes the app&apos;s access to your Pages.
        </li>
      </ul>

      <h2>If you are a customer who messaged a shop</h2>
      <p>
        Send us an email at <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> with the subject
        &quot;Data deletion request&quot;. Include your Facebook profile name and the name of the Page
        you messaged, so we can find your conversation. We will delete your messages, name and order
        details linked to that Page.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Account details (name, phone, email, password hash).</li>
        <li>Shop data: products, bot settings, saved AI key and Page tokens.</li>
        <li>Conversations and messages, and customer details stored with orders.</li>
        <li>Push notification subscriptions.</li>
      </ul>
      <p>
        Some payment and billing records may be kept where needed for accounting or legal reasons.
      </p>

      <h2>How long it takes</h2>
      <p>
        We confirm your request by reply and complete deletion within 30 days. Backups may take a little
        longer to clear.
      </p>

      <p>
        More about how we handle data is in our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}