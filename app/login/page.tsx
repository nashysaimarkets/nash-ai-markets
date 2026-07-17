import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Member Login", description: "Secure member access to the NASH AI Terminal™." };

export default function Login() {
  return <main className="outcome loginPage"><div className="outcomeCard loginCard"><span className="outcomeMark">↗</span><p className="kicker">MEMBER ACCESS</p><h1>Enter the<br/><em>NASH AI Terminal™.</em></h1><p>Use the email address attached to your membership. We’ll email you a secure, password-free sign-in link.</p><LoginForm/><small>Not a member yet? <Link href="/#membership">Compare plans</Link> · <a href="mailto:hello@nashaimarkets.com">Get help</a></small></div></main>;
}
