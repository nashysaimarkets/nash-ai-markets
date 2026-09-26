import { createAdminClient } from "../../../utils/supabase/admin.ts";
import type { CampaignAttribution } from "../marketing-attribution.ts";
import type { PocketFunnelEvent } from "../marketing-funnel.ts";

function isTestDeployment(): boolean {
  const vercelEnvironment = process.env.VERCEL_ENV;
  return vercelEnvironment
    ? vercelEnvironment !== "production"
    : process.env.NODE_ENV !== "production";
}

export async function recordPocketGrowthEvent(
  event: PocketFunnelEvent,
  attribution: CampaignAttribution,
): Promise<boolean> {
  try {
    const { error } = await createAdminClient({ db: { retry: false } })
      .rpc("record_pocket_growth_event", {
        p_event: event,
        p_platform: "web",
        p_source: attribution.source,
        p_campaign: attribution.campaign,
        p_flow: "founding650",
        p_is_test: isTestDeployment(),
        p_duration_ms: 0,
      });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Pocket funnel event was not recorded", {
      category: "pocket_funnel_event_failure",
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
