import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Completing Secure Sign-In",
  description: "Completing secure passwordless access to NASH AI Markets.",
  robots: { index: false, follow: false },
};

export default function ImplicitAuthLayout({ children }: { children: ReactNode }) {
  return children;
}
