export type LaunchEmailTemplate = {
  template: "waitlist-confirmation" | "founding-member-welcome";
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

export function buildWaitlistConfirmationEmail(): LaunchEmailTemplate {
  return {
    template: "waitlist-confirmation",
    subject: "NASH AI Markets private beta request received",
    text: [
      "Your request for NASH AI Markets private beta updates has been recorded.",
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
    subject: "Welcome to the NASH AI Markets private beta",
    text: [
      "Your Founding Member onboarding review has been accepted.",
      "Your existing Stripe-backed membership remains the source of feature entitlement.",
      "This designation does not change billing or guarantee market outcomes.",
      "NASH AI Markets provides educational decision support, not personalised financial advice.",
    ].join("\n\n"),
  };
}
