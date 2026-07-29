import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — PawTrack" };

const UPDATED = "26 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="lead">Last updated {UPDATED}. This document is provided in English.</p>

      <p>
        PawTrack (&ldquo;PawTrack&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) helps neighbours organise community searches for
        lost dogs. This policy explains what personal information we collect, why, and the choices you have. By using
        PawTrack you agree to the handling of information described here.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> you provide: your display name, phone number, an optional username, and — if you
          choose to connect it — your Telegram account (its ID and username). Your password is never stored in readable
          form; we keep only a salted cryptographic hash of it.
        </li>
        <li>
          <strong>Profile details</strong> you add: an optional profile photo and short bio.
        </li>
        <li>
          <strong>Content you create</strong>: lost-dog listings (photos, breed/colour/description, microchip number, and the
          contact phone you enter), reported sightings, map coverage paths, photos and locations of dogs you find, and any
          bug reports (including screenshots) you submit.
        </li>
        <li>
          <strong>Location</strong>: when you allow it, your device&rsquo;s approximate location is used to sort nearby
          searches, mark where a dog was last seen or found, and record coverage. You can decline or revoke this at any time
          in your browser or device settings.
        </li>
        <li>
          <strong>Technical data</strong>: basic information your browser sends (such as device/browser type) and the
          cookies described below.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To run searches: publishing your listing to the community, showing maps and coverage, and coordinating people.</li>
        <li>To let searchers reach you about a found dog, via the contact details you provide.</li>
        <li>To send you notifications in the app and, if you connect Telegram, through the Telegram bot.</li>
        <li>To operate, secure, and improve the service and to prevent abuse.</li>
      </ul>

      <h2>What is visible to others</h2>
      <p>
        PawTrack is a community tool, so some information is shown to other users by design. Listings you create — the dog&rsquo;s
        details and photos, your display name, and the contact phone you provide — are visible to other signed-in users; the
        phone number is revealed only when a user taps to show it. Your public profile (name, username, photo, bio, search
        stats, and achievements) is also visible. Your account phone number is otherwise kept private and is shown only on the
        listings you create.
      </p>

      <h2>On-device photo matching</h2>
      <p>
        The &ldquo;I found a dog&rdquo; feature can compare photos to nearby listings. The visual analysis runs in your own
        browser; the resulting numeric image descriptors may be stored with a listing or sighting to enable later matching.
        We do not use them for any other purpose.
      </p>

      <h2>Telegram</h2>
      <p>
        Connecting Telegram is optional. If you do, we store your Telegram user ID and username to sign you in, deliver
        notifications, and let you record live-location coverage through the bot. You can disconnect Telegram from your
        profile.
      </p>

      <h2>Cookies</h2>
      <p>
        We use only functional cookies that are necessary for the app to work: a session cookie that keeps you signed in, and
        small preferences for your chosen language and light/dark theme. We do not use third-party advertising or tracking
        cookies.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share it only with the service providers that host our application and
        database so the service can run, and where required by law. Content you post is shared with other users as part of how
        PawTrack works.
      </p>

      <h2>Retention</h2>
      <p>
        We keep your information while your account is active. When you delete your account, your profile, listings, sightings,
        coverage, and other associated data are permanently removed from our database.
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>Access and correct your profile details at any time in the app.</li>
        <li>Delete your account and all associated data from <strong>Settings → Danger zone</strong>.</li>
        <li>Grant or withdraw location access through your browser or device.</li>
        <li>Connect or disconnect Telegram from your profile.</li>
      </ul>

      <h2>Children</h2>
      <p>PawTrack is not directed to children under 16, and we do not knowingly collect their personal information.</p>

      <h2>Security</h2>
      <p>
        We protect your data with measures including hashed passwords, encrypted connections, and access controls. No online
        service can be perfectly secure, but we work to keep your information safe.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy from time to time. Material changes will be reflected by the &ldquo;last updated&rdquo; date above.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or a request about your data? Reach us through the <strong>Report a bug</strong> form in
        Settings, and we will follow up.
      </p>
    </>
  );
}
