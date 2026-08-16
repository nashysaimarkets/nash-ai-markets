import Link from "next/link";

const copy = {
  expired: {
    kicker: "MEMBERSHIP EXPIRED",
    title: "Renew terminal access",
    message: "Your paid membership period has ended. You can continue with the Free dashboard or review Pro and Elite options to restore terminal access.",
    primaryHref: "/pricing",
    primaryLabel: "Review membership options",
    secondaryHref: "/dashboard",
    secondaryLabel: "Continue with Free dashboard",
  },
  temporary: {
    kicker: "ACCESS CHECK UNAVAILABLE",
    title: "We could not verify access",
    message: "The membership service is temporarily unavailable. This does not mean your subscription ended, and you should not purchase again. Please retry the access check shortly.",
    primaryHref: "/terminal",
    primaryLabel: "Retry access check",
    secondaryHref: "/help",
    secondaryLabel: "Get access help",
  },
  missing: {
    kicker: "MEMBERSHIP REQUIRED",
    title: "Unlock the NASH AI Terminal™",
    message: "Your login is working, but this email does not currently have an active Pro or Elite membership. Free dashboard tools remain available.",
    primaryHref: "/pricing",
    primaryLabel: "Compare memberships",
    secondaryHref: "/dashboard",
    secondaryLabel: "Continue with Free dashboard",
  },
} as const;

export default async function MembershipRequired({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const reason = (await searchParams).reason;
  const state = reason === "expired" ? copy.expired : reason === "temporary" ? copy.temporary : copy.missing;
  return <main className="legalPage">
    <Link href="/" className="brand"><span className="mark"><i /></span><span>NASH <b>AI</b> MARKETS</span></Link>
    <section className="legalCard">
      <span className="kicker">{state.kicker}</span>
      <h1>{state.title}</h1>
      <p>{state.message}</p>
      <p><Link className="primary" href={state.primaryHref}>{state.primaryLabel} <span>↗</span></Link></p>
      <p><Link href={state.secondaryHref}>{state.secondaryLabel}</Link></p>
      <p><a href="/auth/signout">Sign in with a different email</a></p>
    </section>
  </main>;
}
