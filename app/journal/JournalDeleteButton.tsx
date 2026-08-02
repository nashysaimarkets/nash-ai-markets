"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JournalDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this journal entry?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" className="journalDelete" onClick={remove} disabled={busy}>
    {busy ? "Deleting…" : "Delete"}
  </button>;
}
