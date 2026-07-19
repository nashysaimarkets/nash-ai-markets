import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo";

const copy = {
  expired: {
    kicker: "MEMBERSHIP EXPIRED",
    title: "Renew terminal access",
    message: "Your membership period has ended. Renew a Pro or Elite membership to restore terminal access.",
  },
  temporary: {
    kicker: "ACCESS CHECK UNAVAILABLE",
    title: "We could not verify access",
    message: "The membership service is temporarily unavailable. No billing or database details were exposed. Please try again shortly.",
  },
  missing: {
    kicker: "MEMBERSHIP REQUIRED",
    title: "Unlock the NASH AI Terminal™",
    message: "Your login is working, but this email does not currently have an active Pro or Elite membership.",
  },
} as const;

export default async function MembershipRequired({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const reason = (await searchParams).reason;
  const state = reason === "expired" ? copy.expired : reason === "temporary" ? copy.temporary : copy.missing;
  return <main className="legalPage membershipGatePage">
    <BrandLogo />
    <section className="legalCard membershipGateCard">
      <div className="membershipGateStatus" aria-hidden="true"><i /><span>Secure access check</span></div>
      <span className="kicker">{state.kicker}</span>
      <h1>{state.title}</h1>
      <p>{state.message}</p>
      <div className="membershipGateActions">
        <Link className="primary" href="/#membership">Choose your membership <span>↗</span></Link>
        <a href="/auth/signout">Sign in with a different email</a>
      </div>
    </section>
  </main>;
}
