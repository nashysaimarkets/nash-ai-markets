import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Member Login", description: "Secure member access to the NASH AI Terminal™.", robots: { index: false, follow: false } };

export default function Login() {
  return <main className="outcome loginPage"><div className="outcomeCard loginCard"><span className="outcomeMark">↗</span><p className="kicker">SECURE ACCESS</p><h1>Enter the<br/><em>NASH AI Terminal™.</em></h1><p>Use your email to open Free access or continue with your Pro or Elite membership. We’ll send a secure, password-free sign-in link.</p><LoginForm/><small>Want the full workflow? <Link href="/#membership">Compare plans</Link> · <a href="mailto:hello@nashaimarkets.com">Get help</a></small></div></main>;
}
