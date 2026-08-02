"use client";
import { useState, type FormEvent } from "react";
import { IDEA_CATEGORIES } from "./lib";

export function IdeaForm() {
  const [state, setState] = useState<"idle"|"saving"|"error"|"success">("idle");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({ message: "Your idea could not be saved." }));
      if (!response.ok) { setMessage(result.message); setState("error"); return; }
      setState("success");
      window.location.replace(`/ideas/${result.id}`);
    } catch {
      setMessage("Your idea could not be saved. Please check your connection and try again.");
      setState("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return <form className="ideaForm" action="/api/ideas" method="post" onSubmit={submit} aria-labelledby="submit-idea-title">
    <div><span>MEMBER INPUT</span><h2 id="submit-idea-title">Submit an idea</h2><p>Tell us what would make your preparation workflow clearer or more useful.</p></div>
    <label>Title<input name="title" minLength={5} maxLength={120} required placeholder="A concise description of your idea" /></label>
    <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option>{IDEA_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
    <label className="ideaFormWide">Description<textarea name="description" minLength={20} maxLength={2000} required rows={6} placeholder="Describe the problem, your proposed improvement and why it would help." /></label>
    <button disabled={state === "saving"}>{state === "saving" ? "Submitting…" : "Submit for review"} <span>↗</span></button>
    <p className={`ideaFormMessage ${state}`} role="status">{state === "success" ? "Idea submitted." : message}</p>
  </form>;
}
