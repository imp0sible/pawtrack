import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — PawTrack" };

const UPDATED = "26 July 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="lead">Last updated {UPDATED}. This document is provided in English.</p>

      <p>
        These terms govern your use of PawTrack. By creating an account or using the service, you agree to them. If you do not
        agree, please do not use PawTrack.
      </p>

      <h2>Eligibility and your account</h2>
      <ul>
        <li>You must be at least 16 years old to use PawTrack.</li>
        <li>Provide accurate information and keep your login credentials secure. You are responsible for activity on your account.</li>
        <li>One account per person. Don&rsquo;t impersonate others or misrepresent your identity.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Post false, misleading, or fraudulent listings, or use PawTrack to scam or deceive others.</li>
        <li>Harass, threaten, or endanger any person, or post unlawful, abusive, or inappropriate content.</li>
        <li>Upload photos or content you don&rsquo;t have the right to share.</li>
        <li>Collect or scrape other users&rsquo; information, including contact details, in bulk or by automated means.</li>
        <li>Send spam, or attempt to disrupt, overload, or gain unauthorised access to the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of the content you post. To operate the service, you grant PawTrack a non-exclusive licence to
        store, display, and distribute that content to other users as part of running searches. You are responsible for the
        content you post and confirm you have the right to share it.
      </p>

      <h2>Contacting and meeting other people</h2>
      <p>
        PawTrack is a coordination tool. We do not verify the identity of users and are not a party to any interaction between
        them. When arranging to meet someone — for example to return a dog — take sensible precautions: meet in a public
        place, bring someone with you where possible, and never share financial information. You interact with other users at
        your own risk.
      </p>

      <h2>No guarantee</h2>
      <p>
        PawTrack helps a community organise, but we cannot and do not guarantee that a lost dog will be found or returned. The
        service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind.
      </p>

      <h2>Moderation</h2>
      <p>
        To keep the community safe, we may review reported content and remove listings or content, or suspend or terminate
        accounts, that violate these terms — including at our reasonable discretion.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, PawTrack and its operator are not liable for any indirect, incidental, or
        consequential damages, or for the conduct of any user, arising from your use of the service.
      </p>

      <h2>Termination</h2>
      <p>
        You may delete your account at any time from <strong>Settings → Danger zone</strong>. We may suspend or end access for
        conduct that violates these terms.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. Continued use after a change means you accept the updated terms.</p>

      <h2>Contact</h2>
      <p>Questions? Reach us through the <strong>Report a bug</strong> form in Settings.</p>
    </>
  );
}
