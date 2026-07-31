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
  description: "Steer a fruit fly and explore how walking emerges across its brain and ventral nerve cord.",
  icons: {
    icon: [{ url: `${assetBase}/flywire-favicon.jpg`, type: "image/jpeg", sizes: "256x256" }],
    shortcut: `${assetBase}/flywire-favicon.jpg`,
    apple: `${assetBase}/flywire-favicon.jpg`,
  },
  openGraph: {
    title: "BANC Explorer — Be the Fly",
    description: "One small step. An entire nervous system.",
    images: [{ url: imageUrl, width: 1536, height: 1024, alt: "BANC Explorer — Be the Fly" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BANC Explorer — Be the Fly",
    description: "One small step. An entire nervous system.",
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
