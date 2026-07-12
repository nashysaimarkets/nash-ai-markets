import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Member Login", description: "Secure member access to the NASH AI Terminal™." };

export default function Login() {
  return <main className="outcome loginPage"><div className="outcomeCard loginCard"><span className="outcomeMark">↗</span><p className="kicker">MEMBER ACCESS</p><h1>Enter the<br/><em>NASH AI Terminal™.</em></h1><p>Sign in with the email address and password connected to your active membership. Access is provisioned after payment verification.</p><LoginForm/><small>Not a member yet? <a href="/#membership">Compare plans</a> · Access problem? <a href="mailto:hello@nashaimarkets.com?subject=Member%20login%20help">Get help</a></small></div></main>;
}
