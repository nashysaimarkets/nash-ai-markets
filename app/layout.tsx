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
  metadataBase: new URL("https://www.nashaimarkets.com"),
  title: {
    default: "NASH AI Markets | Pre-Market Mission Control",
    template: "%s | NASH AI Markets",
  },
  description: "See the market, what changed, and what would change the plan—from pre-market preparation through the closing review.",
  applicationName: "NASH AI Markets",
  authors: [{ name: "NASH AI Markets", url: "https://www.nashaimarkets.com" }],
  creator: "NASH AI Markets",
  publisher: "NASH AI Markets",
  category: "Finance",
  keywords: ["S&P 500 futures", "pre-market planning", "market scenarios", "market analysis", "trading risk management"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "NASH AI Markets — See What Changes the Plan",
    description: "Verified market context, conditional paths and decision review—from pre-market through the close.",
    type: "website",
    url: "/",
    siteName: "NASH AI Markets",
    locale: "en_GB",
    images: [
      {
        url: "/og-v2.jpg",
        width: 1200,
        height: 630,
        alt: "NASH AI Markets — See the market and see what changes the plan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NASH AI Markets — See What Changes the Plan",
    description: "Verified market context and decision review—from pre-market through the close.",
    images: ["/og-v2.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "NASH AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  other: {
    "theme-color": "#050807",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1179x2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-2048x2732.png" media="(min-device-width: 768px) and (max-device-width: 1366px) and (-webkit-min-device-pixel-ratio: 2)" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
