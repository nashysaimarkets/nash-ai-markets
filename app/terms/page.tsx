import type { Metadata } from "next";
import { PublicPageHeader } from "../components/PublicPageHeader.tsx";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for NASH AI Markets.",
};

export default function Terms() {
  return <main className="legal"><PublicPageHeader /><article>
    <span>LEGAL</span><h1>Terms of Use</h1><p className="updated">Last updated: 17 July 2026</p>
    <h2>Educational information only</h2><p>NASH AI Markets provides general educational commentary. Nothing on this site or in a briefing is personal financial advice, a recommendation, an offer, or a solicitation to buy or sell any financial instrument.</p>
    <h2>Trading risk</h2><p>Futures and options can produce substantial and rapid losses, including losses greater than an initial investment. You are solely responsible for your decisions, position sizing and risk management. Past performance does not predict future results.</p>
    <h2>No guarantee</h2><p>Markets are uncertain. We do not guarantee the accuracy, completeness or timeliness of information, uninterrupted access, or any trading outcome. Illustrative levels and scenarios are not live signals unless clearly stated otherwise.</p>
    <h2>Membership and billing</h2><p>Paid memberships are billed through Stripe at the price and interval shown during checkout. Subscription management and cancellation are available through the customer portal or support. Cancellation stops future renewal and does not normally reverse a completed billing period unless required by law or an expressly stated refund policy.</p>
    <h2>Founding 100</h2><p>Founding 100 Pro and Founding 100 Elite are limited to the first 100 successful subscribers recorded for each programme. An eligible member keeps the checkout subscription price while that same subscription remains continuously active. Cancellation, lapse or loss of paid status permanently ends that price lock. A later subscription is charged at the standard price then available. The historic Founding badge remains as a record of the award, but does not restore forfeited pricing.</p>
    <h2>Service availability</h2><p>Provider outages, delayed data, maintenance and other technical conditions may limit or suspend market output. Bullseye fails closed when current verified inputs are unavailable, and membership does not guarantee uninterrupted market-data availability.</p>
    <h2>Acceptable use</h2><p>Content is for your personal use. You may not republish, resell, scrape or distribute briefings without written permission.</p>
    <h2>Contact</h2><p>Questions can be sent to <a href="mailto:hello@nashaimarkets.com">hello@nashaimarkets.com</a>.</p>
  </article></main>;
}
