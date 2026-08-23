export type LaunchEmailTemplate = {
  template: "waitlist-confirmation" | "founding-member-welcome" | "pocket-founding-welcome" | "pocket-subscription-alert" | "membership-welcome" | "payment-successful" | "founding-100-confirmation" | "annual-renewal-reminder" | "subscription-cancellation";
  subject: string;
  text: string;
};

export type LaunchEmailReadiness = {
  providerConfigured: boolean;
  senderConfigured: boolean;
  credentialConfigured: boolean;
  ready: boolean;
};

export function getLaunchEmailReadiness(
  environment: Record<string, string | undefined> = process.env,
): LaunchEmailReadiness {
  const provider = environment.LAUNCH_EMAIL_PROVIDER?.trim().toLowerCase() ?? "";
  const providerConfigured = provider === "resend";
  const senderConfigured = Boolean(environment.LAUNCH_EMAIL_FROM?.trim());
  const credentialConfigured = provider === "resend" && Boolean(environment.RESEND_API_KEY?.trim());
  return {
    providerConfigured,
    senderConfigured,
    credentialConfigured,
    ready: providerConfigured && senderConfigured && credentialConfigured,
  };
}

type PaidPlan = "pro" | "elite";
const brandFooter = "NASH AI Markets provides educational market commentary, not personalised financial advice.";

export function buildPocketFoundingWelcomeEmail(pocketUrl: string): LaunchEmailTemplate {
  return {
    template: "pocket-founding-welcome",
    subject: "Welcome to Pocket Bullseye — start with your first chart",
    text: [
      "Welcome to Pocket Bullseye. Your Founding 650 subscription has been confirmed.",
      `OPEN POCKET\n${pocketUrl}`,
      "SAVE POCKET TO YOUR PHONE\niPhone: open Pocket in Safari, tap Share, then Add to Home Screen.\nAndroid: open Pocket in Chrome, tap the menu, then Add to Home screen or Install app.\nDesktop: use the install icon in the browser address bar, or bookmark Pocket.",
      "UPLOAD YOUR FIRST CHART\n1. Tap LOAD CHART.\n2. Choose a clear screenshot showing the instrument, timeframe and price scale.\n3. Remove your name, account number, balance and notifications before uploading.\n4. Choose LONG, SHORT or JUST ANALYSE, confirm the Privacy Shield, then tap CHALLENGE MY SETUP.",
      "SEND FEEDBACK\nTap the green FEEDBACK button at the bottom-right of Pocket. Choose REPORT A PROBLEM if something is not working, or SHARE AN IDEA to help shape the product. You can also email hello@nashaimarkets.com.",
      "Your £4.99 Founding 650 price remains locked while this subscription stays continuously active.",
      "Pocket Bullseye provides educational chart analysis only. It does not provide personalised financial advice, execute trades or guarantee outcomes.",
    ].join("\n\n"),
  };
}

export function buildPocketSubscriptionAlertEmail(customerEmail: string, dashboardUrl: string): LaunchEmailTemplate {
  return {
    template: "pocket-subscription-alert",
    subject: "New Pocket Bullseye subscription \uD83C\uDFAF",
    text: [
      "A new Pocket Bullseye Founding 650 subscription has been verified by Stripe.",
      `Customer: ${customerEmail}`,
      "Price: \u00A34.99 per month",
      `OPEN LAUNCH CONTROL\n${dashboardUrl}`,
      "No payment-card information is included in this notification.",
    ].join("\n\n"),
  };
}

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
