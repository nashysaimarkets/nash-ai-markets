"use client";

import { useEffect, useState } from "react";

export const LOGIN_STING_PENDING_KEY = "bullseye:login-sting:pending";
export const LOGIN_STING_MUTED_KEY = "bullseye:login-sting:muted";

const PENDING_WINDOW_MS = 15 * 60 * 1_000;

function playBullseyeSting() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.58);
  master.connect(context.destination);

  [220, 440, 659.25].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startsAt = context.currentTime + index * 0.075;
    oscillator.type = index === 2 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(index === 2 ? 0.7 : 0.45, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.36);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.38);
  });

  window.setTimeout(() => void context.close(), 800);
}

export function BullseyeLoginSting() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let isMuted = true;
    let shouldPlay = false;
    try {
      isMuted = window.localStorage.getItem(LOGIN_STING_MUTED_KEY) === "1";
      const pendingAt = Number(window.localStorage.getItem(LOGIN_STING_PENDING_KEY));
      shouldPlay = Number.isFinite(pendingAt) && Date.now() - pendingAt < PENDING_WINDOW_MS;
      window.localStorage.removeItem(LOGIN_STING_PENDING_KEY);
    } catch {
      // Private browsing may block storage. The dashboard remains fully usable.
    }
    setMuted(isMuted);
    if (shouldPlay && !isMuted) playBullseyeSting();
  }, []);

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(LOGIN_STING_MUTED_KEY, next ? "1" : "0");
    } catch {
      // Preference persistence is optional.
    }
    if (!next) playBullseyeSting();
  }

  return (
    <button
      className="memberSoundToggle"
      type="button"
      onClick={toggleSound}
      aria-pressed={!muted}
      title={muted ? "Enable the optional Bullseye login sound" : "Mute the Bullseye login sound"}
    >
      <span aria-hidden="true">{muted ? "◌" : "◉"}</span>
      Login sound {muted ? "off" : "on"}
    </button>
  );
}
