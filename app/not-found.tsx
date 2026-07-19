import Link from "next/link";
import { BrandLogo } from "./components/BrandLogo";
export default function NotFound(){return <main className="brandSystemState"><div className="brandSystemStateGrid" aria-hidden="true"/><BrandLogo/><section><span>404 / ROUTE UNAVAILABLE</span><h1>This page is outside the current mission.</h1><p>The address may have changed. No account or market data has been affected.</p><div className="brandSystemStateActions"><Link href="/">Return to NASH AI Markets</Link><Link href="/help">Visit help centre</Link></div></section></main>}
