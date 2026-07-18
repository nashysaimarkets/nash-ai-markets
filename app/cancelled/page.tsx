import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo.tsx";
export const metadata: Metadata = { title: "Checkout Cancelled", description: "Your NASH AI Markets checkout was cancelled." };
export default function Cancelled() { return <main className="outcome"><div className="outcomeCard"><BrandLogo /><span className="outcomeMark muted">×</span><p className="kicker">CHECKOUT CANCELLED</p><h1>No problem.<br/><em>Nothing was charged.</em></h1><p>Your checkout was cancelled and no payment has been taken. You can return to the membership page whenever you’re ready.</p><Link className="primary" href="/#membership">Return to membership <span>↗</span></Link><small>Questions? <a href="mailto:hello@nashaimarkets.com">Email us</a></small></div></main> }
