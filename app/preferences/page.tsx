import { redirect } from "next/navigation";

/**
 * Preferences is labelled in member navigation but the workspace preference
 * controls already live at /onboarding. Keep /preferences as a stable URL
 * that never 404s, without inventing a second settings surface.
 */
export default function PreferencesAliasPage() {
  redirect("/onboarding");
}
