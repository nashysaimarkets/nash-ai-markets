"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function JournalForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setTone(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      tradedAt: String(data.get("tradedAt") ?? ""),
      instrumentClass: String(data.get("instrumentClass") ?? ""),
      underlying: String(data.get("underlying") ?? ""),
      direction: String(data.get("direction") ?? ""),
      entryPrice: data.get("entryPrice") ? Number(data.get("entryPrice")) : null,
      stopPrice: data.get("stopPrice") ? Number(data.get("stopPrice")) : null,
      targetPrice: data.get("targetPrice") ? Number(data.get("targetPrice")) : null,
      positionSize: String(data.get("positionSize") ?? "") || null,
      optionsStrategy: String(data.get("optionsStrategy") ?? "") || null,
      notes: String(data.get("notes") ?? "") || null,
      reason: String(data.get("reason") ?? "") || null,
      emotion: String(data.get("emotion") ?? "") || null,
      followedPlan: data.get("followedPlan") === "yes" ? true : data.get("followedPlan") === "no" ? false : null,
      lesson: String(data.get("lesson") ?? "") || null,
      pnl: data.get("pnl") ? Number(data.get("pnl")) : null,
    };

    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setTone("error");
        setMessage(payload.message ?? "Your journal entry could not be saved. Please try again.");
        return;
      }
      setTone("success");
      setMessage("Journal entry saved.");
      form.reset();
      router.refresh();
    } catch {
      setTone("error");
      setMessage("Your journal entry could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="journalForm" onSubmit={submit}>
    <header>
      <span>NEW ENTRY</span>
      <h2>Log a trade</h2>
      <p>Private to your account. Optional fields can stay blank — never invent fills.</p>
    </header>
    <div className="journalFormGrid">
      <label>Traded at<input name="tradedAt" type="datetime-local" required /></label>
      <label>Instrument
        <select name="instrumentClass" required defaultValue="futures">
          <option value="futures">Futures</option>
          <option value="options">Options</option>
        </select>
      </label>
      <label>Underlying<input name="underlying" required maxLength={32} placeholder="ES" /></label>
      <label>Direction
        <select name="direction" required defaultValue="long">
          <option value="long">Long</option>
          <option value="short">Short</option>
          <option value="neutral">Neutral</option>
        </select>
      </label>
      <label>Entry<input name="entryPrice" type="number" step="any" /></label>
      <label>Stop<input name="stopPrice" type="number" step="any" /></label>
      <label>Target<input name="targetPrice" type="number" step="any" /></label>
      <label>P&amp;L<input name="pnl" type="number" step="any" /></label>
      <label>Position size<input name="positionSize" maxLength={64} /></label>
      <label>Options strategy<input name="optionsStrategy" maxLength={80} /></label>
      <label>Followed plan
        <select name="followedPlan" defaultValue="">
          <option value="">Not recorded</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label>Emotion<input name="emotion" maxLength={64} /></label>
      <label className="journalFormWide">Reason<textarea name="reason" rows={2} maxLength={500} /></label>
      <label className="journalFormWide">Notes<textarea name="notes" rows={3} maxLength={2000} /></label>
      <label className="journalFormWide">Lesson<textarea name="lesson" rows={2} maxLength={500} /></label>
    </div>
    <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save entry"}</button>
    <span role={tone === "error" ? "alert" : "status"} data-tone={tone} aria-live="polite">{message}</span>
  </form>;
}
