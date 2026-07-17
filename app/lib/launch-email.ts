export type LaunchEmailTemplate = {
  template: "waitlist-confirmation" | "founding-member-welcome" | "membership-welcome" | "payment-successful" | "founding-100-confirmation" | "annual-renewal-reminder" | "subscription-cancellation";
  subject: string;
  text: string;
};

export type LaunchEmailReadiness = {
  providerConfigured: boolean;
  senderConfigured: boolean;
  ready: boolean;
};

export function getLaunchEmailReadiness(
  environment: Record<string, string | undefined> = process.env,
): LaunchEmailReadiness {
  const providerConfigured = Boolean(environment.LAUNCH_EMAIL_PROVIDER?.trim());
  const senderConfigured = Boolean(environment.LAUNCH_EMAIL_FROM?.trim());
  return {
    providerConfigured,
    senderConfigured,
    ready: providerConfigured && senderConfigured,
  };
}

type PaidPlan = "pro" | "elite";
const brandFooter = "NASH AI Markets provides educational market commentary, not personalised financial advice.";

export function buildMembershipWelcomeEmail(plan: PaidPlan): LaunchEmailTemplate {
  return { template: "membership-welcome", subject: `Welcome to NASH AI Markets ${plan.toUpperCase()}`, text: [`Your ${plan.toUpperCase()} membership is active.`, "Sign in using the email address used at checkout.", brandFooter].join("\n\n") };
}

export function buildPaymentSuccessfulEmail(plan: PaidPlan, renewalDate: string): LaunchEmailTemplate {
  return { template: "payment-successful", subject: "NASH AI Markets payment confirmed", text: [`Your ${plan.toUpperCase()} subscription payment was confirmed by Stripe.`, `Recorded renewal date: ${renewalDate}.`, "Manage billing securely through the Stripe customer portal.", brandFooter].join("\n\n") };
}

export function buildFounding100ConfirmationEmail(plan: PaidPlan, position: number): LaunchEmailTemplate | null {
  if (!Number.isInteger(position) || position < 1 || position > 100) return null;
  return { template: "founding-100-confirmation", subject: `Founding 100 ${plan.toUpperCase()} confirmed`, text: [`You have earned Founding 100 ${plan.toUpperCase()} member #${position}.`, "Your checkout subscription price remains locked while this same subscription stays continuously active.", "Cancellation or lapse permanently ends the price lock; a future subscription uses the then-current standard price.", brandFooter].join("\n\n") };
}

export function buildAnnualRenewalReminderEmail(plan: PaidPlan, renewalDate: string): LaunchEmailTemplate {
  return { template: "annual-renewal-reminder", subject: `Your ${plan.toUpperCase()} annual renewal is approaching`, text: [`Your annual ${plan.toUpperCase()} membership is scheduled to renew on ${renewalDate}.`, "Review billing details in the Stripe customer portal before renewal.", brandFooter].join("\n\n") };
}

export function buildSubscriptionCancellationEmail(plan: PaidPlan, accessEnd: string, foundingPriceLockLost: boolean): LaunchEmailTemplate {
  return { template: "subscription-cancellation", subject: `Your ${plan.toUpperCase()} subscription has been cancelled`, text: [`Your ${plan.toUpperCase()} access is recorded through ${accessEnd}.`, foundingPriceLockLost ? "Your Founding badge remains in programme history, but the lifetime price lock has been permanently lost." : "No further renewal is scheduled.", "A future subscription uses the price available at that time.", brandFooter].join("\n\n") };
}

export function buildWaitlistConfirmationEmail(): LaunchEmailTemplate {
  return {
    template: "waitlist-confirmation",
    subject: "NASH AI Markets launch request received",
    text: [
      "Your request for NASH AI Markets launch updates has been recorded.",
      "Joining the waiting list does not guarantee an invitation and does not create a paid subscription.",
      "We will contact you only with relevant launch or account information.",
      "NASH AI Markets provides educational market commentary, not personalised financial advice.",
    ].join("\n\n"),
  };
}

export function buildFoundingMemberWelcomeEmail(
  reviewStatus: "pending" | "accepted" | "declined",
): LaunchEmailTemplate | null {
  if (reviewStatus !== "accepted") return null;
  return {
    template: "founding-member-welcome",
    subject: "Welcome to NASH AI Markets",
    text: [
      "Your Founding Member onboarding review has been accepted.",
      "Your existing Stripe-backed membership remains the source of feature entitlement.",
      "This designation does not change billing or guarantee market outcomes.",
      "NASH AI Markets provides educational decision support, not personalised financial advice.",
    ].join("\n\n"),
  };
}
