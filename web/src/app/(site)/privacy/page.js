import LegalPage, { CONTACT } from "@/components/site/LegalPage";

export const metadata = {
  title: "Privacy Policy | FarseIT",
  description: "How Farse AI by FarseIT collects, uses and protects data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 4, 2026">
      <p>
        Farse AI is a Messenger sales assistant operated by FarseIT (&quot;we&quot;, &quot;us&quot;).
        It lets online shop owners connect their Facebook Page so an AI assistant can answer
        customer messages and take orders. This policy explains what data we handle and why.
      </p>

      <h2>1. Who this applies to</h2>
      <ul>
        <li><strong>Shop owners and staff</strong> who create an account on {CONTACT.site}.</li>
        <li><strong>Customers</strong> who send a message to a Facebook Page that uses Farse AI.</li>
      </ul>

      <h2>2. Data we collect</h2>
      <p><strong>From shop owners:</strong></p>
      <ul>
        <li>Name, mobile number, email (optional) and a password (stored only as a one-way hash).</li>
        <li>Shop details: shop name, products, prices, images, bot settings and rules you write.</li>
        <li>Facebook Page ID, Page name and a Page access token (stored encrypted).</li>
        <li>An optional Gemini API key if you add your own (stored encrypted).</li>
        <li>Payment details you submit for a plan: bKash or Nagad sender number, amount and transaction ID.</li>
        <li>Browser push notification subscription, if you turn on notifications.</li>
      </ul>
      <p><strong>From customers who message a connected Page:</strong></p>
      <ul>
        <li>Your Messenger page-scoped ID (PSID) and display name provided by Meta.</li>
        <li>The messages you send and the replies you receive.</li>
        <li>Order details you give the assistant: name, phone number, delivery address and items.</li>
      </ul>
      <p>
        We also keep technical logs such as IP address (for rate limiting and abuse protection) and AI
        usage counts per shop.
      </p>

      <h2>3. How we use data</h2>
      <ul>
        <li>To let the AI assistant reply to customers and create orders for the shop.</li>
        <li>To show conversations, orders and products in the shop dashboard.</li>
        <li>To send shop owners alerts (for example a new order or a chat that needs a human).</li>
        <li>To run billing, plan limits and account security (for example password reset by SMS).</li>
        <li>To detect and fix problems, and to prevent spam and abuse.</li>
      </ul>
      <p>
        Data received from Meta (Facebook Pages and Messenger) is used only to provide the service
        described here. We do not sell it, and we do not use it for advertising.
      </p>

      <h2>4. Facebook and Messenger permissions</h2>
      <p>When a shop owner connects a Page we ask for these permissions, only for the reasons below:</p>
      <ul>
        <li><strong>pages_show_list</strong>: to show the Pages you manage so you can choose one.</li>
        <li><strong>pages_manage_metadata</strong>: to subscribe the Page to our webhook so we receive its messages.</li>
        <li><strong>pages_messaging</strong>: to receive customer messages and send replies from the Page.</li>
        <li><strong>pages_read_engagement</strong>: to read basic Page information needed for messaging.</li>
        <li><strong>business_management</strong>: required by Meta as a dependency of the permissions above.</li>
      </ul>

      <h2>5. Who we share data with</h2>
      <p>We share data only with service providers needed to run Farse AI:</p>
      <ul>
        <li><strong>Meta</strong>: to receive and send Messenger messages.</li>
        <li><strong>AI providers</strong> (Google Gemini or Anthropic Claude): recent conversation text and product details are sent to generate replies.</li>
        <li><strong>Cloudinary</strong>: to store product images.</li>
        <li><strong>SMS gateway</strong>: to send password reset codes.</li>
        <li><strong>Hosting providers</strong> (for example Render and Vercel): to run the application and database.</li>
      </ul>
      <p>
        Customer messages and orders are visible to the shop that owns the Page. We may also disclose
        data if required by law.
      </p>

      <h2>6. Security</h2>
      <p>
        Passwords are hashed. Facebook Page tokens and API keys are encrypted before being saved.
        Connections use HTTPS. No system is perfectly secure, but we work to protect your data.
      </p>

      <h2>7. Retention and deletion</h2>
      <p>
        We keep data while the shop account is active. You can disconnect a Page at any time, which
        removes its stored token. To delete your data, follow the steps on our{" "}
        <a href="/data-deletion">Data Deletion page</a>. Some payment records may be kept longer where
        needed for accounting or legal reasons.
      </p>

      <h2>8. Your choices</h2>
      <p>
        You can ask to access, correct or delete your data at any time. You can also remove Farse AI
        from your Facebook account under Settings, Business Integrations.
      </p>

      <h2>9. Children</h2>
      <p>Farse AI is not intended for people under 18, and we do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. The date at the top shows the latest version. Continued use of the
        service means you accept the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        FarseIT, Bangladesh. Email: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. Phone:{" "}
        {CONTACT.phone}.
      </p>
    </LegalPage>
  );
}