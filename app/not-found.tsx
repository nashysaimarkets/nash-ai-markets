import Link from "next/link";
import { BrandLogo } from "./components/BrandLogo.tsx";

export default function NotFound() {
  return <main className="outcome">
    <div className="outcomeCard systemStateCard">
      <BrandLogo />
      <p className="kicker">404 · ROUTE NOT FOUND</p>
      <h1>This page is<br /><em>outside the map.</em></h1>
      <p>The requested route is unavailable. No account, billing, or market information has been affected.</p>
      <Link className="primary" href="/">Return to NASH AI Markets <span>↗</span></Link>
    </div>
  </main>;
}
