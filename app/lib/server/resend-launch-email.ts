import type { LaunchEmailTemplate } from "../launch-email.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type LaunchEmailDispatchResult =
  | { status: "sent"; provider: "resend"; messageId: string | null }
  | { status: "disabled"; reason: "provider" | "sender" | "credential" }
  | { status: "rejected"; reason: "recipient" | "idempotency" }
  | { status: "failed"; reason: "provider_unavailable" };

function validEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function validSender(value: string): boolean {
  const trimmed = value.trim();
  if (validEmail(trimmed)) return true;
  const match = /^([^<>\r\n]{1,80})\s*<([^<>\s]+)>$/.exec(trimmed);
  return Boolean(match && validEmail(match[2]));
}

export async function dispatchLaunchEmail(
  input: {
    to: string;
    email: LaunchEmailTemplate;
    idempotencyKey: string;
  },
  options: {
    environment?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  } = {},
): Promise<LaunchEmailDispatchResult> {
  const environment = options.environment ?? process.env;
  const provider = environment.LAUNCH_EMAIL_PROVIDER?.trim().toLowerCase();
  const from = environment.LAUNCH_EMAIL_FROM?.trim() ?? "";
  const apiKey = environment.RESEND_API_KEY?.trim() ?? "";

  if (provider !== "resend") return { status: "disabled", reason: "provider" };
  if (!validSender(from)) return { status: "disabled", reason: "sender" };
  if (!apiKey) return { status: "disabled", reason: "credential" };
  if (!validEmail(input.to)) return { status: "rejected", reason: "recipient" };
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)) {
    return { status: "rejected", reason: "idempotency" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to.trim().toLowerCase()],
        subject: input.email.subject,
        text: input.email.text,
      }),
      cache: "no-store",
    });

    if (!response.ok) return { status: "failed", reason: "provider_unavailable" };
    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return {
      status: "sent",
      provider: "resend",
      messageId: typeof payload?.id === "string" ? payload.id : null,
    };
  } catch {
    return { status: "failed", reason: "provider_unavailable" };
  }
}
