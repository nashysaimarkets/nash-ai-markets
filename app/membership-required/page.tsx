import Link from "next/link";

export default function MembershipRequired() {
  return <main className="legalPage">
    <Link href="/" className="brand"><span className="mark"><i /></span><span>NASH <b>AI</b> MARKETS</span></Link>
    <section className="legalCard">
      <span className="kicker">MEMBERSHIP REQUIRED</span>
      <h1>Unlock the NASH AI Terminal™</h1>
      <p>Your login is working, but this email does not currently have an active Pro or Elite membership.</p>
      <p><Link className="primary" href="/#membership">Choose your membership <span>↗</span></Link></p>
      <p><a href="/auth/signout">Sign in with a different email</a></p>
    </section>
  </main>;
}
