"use client";

import { useState, type FormEvent } from "react";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!response.ok) {
        setMessage(response.status === 400
          ? "Enter a name between 2 and 60 characters."
          : "Your profile could not be updated. Please try again.");
        return;
      }
      setMessage("Profile updated.");
    } catch {
      setMessage("Your profile could not be updated. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="profileForm" onSubmit={submit}>
    <label htmlFor="display-name">Display name</label>
    <p>Used only to personalize your signed-in NASH AI Markets experience.</p>
    <div><input id="display-name" name="displayName" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} autoComplete="name" required /><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
    <span role="status" aria-live="polite">{message}</span>
  </form>;
}
