import type { Metadata } from "next";
import Link from "next/link";
import "../pocket-founding.css";
import "./welcome.css";
export const metadata:Metadata={title:"Welcome to Pocket Bullseye",robots:{index:false,follow:false}};
export default function PocketFoundingWelcome(){return <main className="pfLaunch pfWelcome"><section><div className="pfWelcomeTarget">🎯</div><span>PAYMENT CONFIRMATION RECEIVED</span><h1>Welcome to<br/><em>Pocket Bullseye.</em></h1><p>Stripe is securely confirming your subscription and Founding 650 position. Use the same email address to access Pocket Bullseye.</p><ol><li>Check for your Stripe receipt.</li><li>Open Pocket Bullseye with the same email.</li><li>If access is still updating, wait briefly and retry—do not purchase twice.</li></ol><Link href="/pocket">OPEN POCKET BULLSEYE →</Link><a href="mailto:hello@nashaimarkets.com?subject=Pocket%20Bullseye%20founder%20feedback">SEND FOUNDER FEEDBACK ↗</a><small>Your £4.99 price lock remains active only while the founding subscription stays continuously active.</small></section></main>}
