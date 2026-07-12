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

export const metadata: Metadata = {
  title: {
    default: "NASH AI Markets | S&P 500 Pre-Market Intelligence",
    template: "%s | NASH AI Markets",
  },
  description: "A focused daily S&P 500 futures briefing with key levels, market catalysts, bullish and bearish scenarios, and a clear risk rating.",
  keywords: ["S&P 500 futures", "pre-market brief", "market analysis", "futures trading", "options trading"],
  openGraph: {
    title: "NASH AI Markets — See the market. Plan the trade.",
    description: "Daily S&P 500 pre-market intelligence, built around scenarios and risk.",
    type: "website",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
