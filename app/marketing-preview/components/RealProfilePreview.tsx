import Link from "next/link";
import { DashboardCard } from "../../components/DashboardCard.tsx";
import { MemberShell } from "../../components/MemberShell.tsx";
import { SubscriptionStatusCard } from "../../components/SubscriptionStatusCard.tsx";

function PreviewProfileForm() {
  return (
    <form className="profileForm">
      <label htmlFor="preview-display-name">Display name</label>
      <p>Used only to personalize your signed-in NASH AI Markets experience.</p>
      <div>
        <input
          id="preview-display-name"
          name="displayName"
          defaultValue="Chris"
          minLength={2}
          maxLength={60}
          autoComplete="off"
          readOnly
        />
        <button type="button">Save profile</button>
      </div>
      <span role="status" data-tone="success" aria-live="polite">
        Example form only — no account change is made.
      </span>
    </form>
  );
}

export function RealProfilePreview() {
  return (
    <MemberShell active="profile" className="profilePage marketingRealMemberPreview">
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>Identity, membership and billing information on this private preview are illustrative.</span>
      </aside>
      <div className="memberDashboardShell">
        <section className="profileHero">
          <div>
            <span>ACCOUNT</span>
            <h1>Your account</h1>
            <p>Manage identity, workspace preferences and subscription access from one secure member hub.</p>
            <strong className="profileMembershipBadge" data-tier="elite">
              ELITE membership · example
            </strong>
          </div>
          <div className="profileHeroActions">
            <Link href="/marketing-preview?view=terminal">Open Trading Desk</Link>
            <a href="#preview-signout">Sign out securely</a>
          </div>
        </section>

        <section className="profileOverview" aria-label="Account overview">
          <article>
            <span>Account status</span>
            <strong>Ready</strong>
            <small>Identity, preferences and access available</small>
          </article>
          <article>
            <span>Membership</span>
            <strong>ELITE</strong>
            <small>Monthly billing · illustrative</small>
          </article>
          <article>
            <span>Workspace</span>
            <strong>Configured</strong>
            <small>Preferences can be updated anytime</small>
          </article>
          <article>
            <span>Security</span>
            <strong>Passwordless</strong>
            <small>Supabase session · Stripe-hosted billing</small>
          </article>
        </section>

        <section className="profileGrid">
          <DashboardCard eyebrow="PERSONAL DETAILS · EXAMPLE" title="Profile identity" className="profileIdentity">
            <div className="profileIdentitySummary">
              <span>C</span>
              <div>
                <strong>Chris</strong>
                <small>member@example.nashaimarkets.com</small>
              </div>
            </div>
            <PreviewProfileForm />
          </DashboardCard>

          <DashboardCard eyebrow="MEMBERSHIP · EXAMPLE" title="Access and billing" className="profileSubscription">
            <SubscriptionStatusCard
              tier="elite"
              status="active"
              billingPlan="elite"
              periodEnd="2026-09-15T23:59:59.000Z"
              portalUrl="#preview-billing"
              verificationUnavailable={false}
              billingInterval="month"
              cancelAtPeriodEnd={false}
            />
          </DashboardCard>

          <DashboardCard eyebrow="WORKSPACE · EXAMPLE" title="Market preferences" className="profilePreferences">
            <div className="profilePreferenceBody">
              <dl>
                <div>
                  <dt>Experience</dt>
                  <dd>Developing a consistent process</dd>
                </div>
                <div>
                  <dt>Interests</dt>
                  <dd>Index futures · Macro and rates · Volatility</dd>
                </div>
                <div>
                  <dt>Notifications</dt>
                  <dd>Morning Brief + essential notices</dd>
                </div>
              </dl>
              <Link href="/marketing-preview?view=preferences">
                Update workspace preferences <span>↗</span>
              </Link>
            </div>
          </DashboardCard>

          <DashboardCard eyebrow="ACCOUNT SECURITY" title="Protected by passwordless access" className="profileSecurity">
            <ul>
              <li>Authentication is managed through Supabase secure sessions.</li>
              <li>Payment-card information remains with Stripe.</li>
              <li>Market and AI provider credentials are never exposed to your browser.</li>
            </ul>
          </DashboardCard>

          <nav className="profileQuickLinks" aria-label="Account quick links">
            <Link href="/marketing-preview">
              <span>01</span>
              <div>
                <strong>Dashboard</strong>
                <small>Return to today’s mission</small>
              </div>
              <i>↗</i>
            </Link>
            <Link href="/pricing">
              <span>02</span>
              <div>
                <strong>Membership options</strong>
                <small>Compare Free, Pro and Elite</small>
              </div>
              <i>↗</i>
            </Link>
            <Link href="/help">
              <span>03</span>
              <div>
                <strong>Help centre</strong>
                <small>Account and product guidance</small>
              </div>
              <i>↗</i>
            </Link>
            <Link href="/risk-disclaimer">
              <span>04</span>
              <div>
                <strong>Risk information</strong>
                <small>Review important product limits</small>
              </div>
              <i>↗</i>
            </Link>
          </nav>
        </section>
        <p id="preview-billing" className="dashDisclosure" role="note">
          Example billing state only. No Stripe portal or account action is opened from this preview.
        </p>
        <p id="preview-signout" className="dashDisclosure" role="note">
          Example account page only. No session is ended from this preview.
        </p>
      </div>
    </MemberShell>
  );
}
