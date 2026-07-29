import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { getLocale } from "@/lib/i18n/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PawTrack — Find lost dogs together",
  description:
    "Organize community searches for lost dogs: shared maps, live coverage, sightings, and Telegram coordination.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PawTrack", statusBarStyle: "default" },
};

// Mobile-first viewport. The browser chrome tints to the surface colour and
// tracks light/dark so the app feels native when installed to the home screen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e0d" },
  ],
};

// Runs before paint to set the theme from storage (or OS), preventing a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('pawtrack:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
