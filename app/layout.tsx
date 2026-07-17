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
  description: "A focused S&P 500 futures intelligence dashboard with provider status, deterministic scenarios, and clear risk controls.",
  keywords: ["S&P 500 futures", "pre-market brief", "market analysis", "futures trading", "options trading"],
  openGraph: {
    title: "NASH AI Markets — See the market. Plan the trade.",
    description: "Provider-backed S&P 500 pre-market intelligence, built around deterministic scenarios and risk.",
    type: "website",
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
