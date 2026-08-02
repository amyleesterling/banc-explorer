import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://banc-explorer.amysterling.chatgpt.site";
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const imageUrl = `${siteUrl}${assetBase}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "BANC Explorer — Be the Fly",
  description: "Drive a fruit fly through walking, steering, feeding, escape, and flight while the neurons behind each behavior light up.",
  icons: {
    icon: [{ url: `${assetBase}/banc-explorer-fly-icon.svg`, type: "image/svg+xml" }],
    shortcut: `${assetBase}/banc-explorer-fly-icon.svg`,
    apple: `${assetBase}/banc-explorer-fly-icon.svg`,
  },
  openGraph: {
    title: "BANC Explorer — Be the Fly",
    description: "Drive the fly. See behavior light up.",
    images: [{ url: imageUrl, width: 1536, height: 1024, alt: "BANC Explorer — Be the Fly" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BANC Explorer — Be the Fly",
    description: "Drive the fly. See behavior light up.",
    images: [imageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
