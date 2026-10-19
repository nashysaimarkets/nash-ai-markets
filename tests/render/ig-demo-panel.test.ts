import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import IgDemoPositionPanel from "../../app/components/IgDemoPositionPanel.tsx";
import type { IgDemoPanelSnapshot } from "../../app/lib/ig-demo-panel.ts";

function snapshot(): IgDemoPanelSnapshot {
  return {
    environment: "DEMO", connectionId: "mock-connection-1", status: "CONNECTED", generation: 1,
    observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300_000).toISOString(),
    account: { accountId: "DEMO1", accountType: "CFD", currency: "GBP" },
    positions: [{ dealId: "D1", epic: "IX.D.SPTRD.DAILY.IP", direction: "BUY", size: 0.5, openLevel: 5100, currency: "GBP", chartContext: "EXACT_IG_PRODUCT" }],
    riskContext: "HOLD_MARKET_SPEC_UNVERIFIED",
  };
}

test("IG position panel is absent unless explicitly enabled", () => {
  assert.equal(renderToStaticMarkup(createElement(IgDemoPositionPanel, { snapshot: snapshot() })), "");
});

test("enabled position panel labels DEMO, risk hold and read-only state with accessible controls", () => {
  const html = renderToStaticMarkup(createElement(IgDemoPositionPanel, { enabled: true, snapshot: snapshot(), onRefresh() {}, onDisconnect() {} }));
  for (const text of ["DEMO", "Read-only", "role=\"status\"", "aria-live=\"polite\"", "Risk comparison is on hold", "IX.D.SPTRD.DAILY.IP", "Disconnect DEMO", "Return to IG"]) assert.ok(html.includes(text), text);
  for (const forbidden of ["password", "securityToken", "X-IG-API-KEY", "Place order", "Execute trade"]) assert.equal(html.includes(forbidden), false);
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes("Position currency GBP"));
  assert.equal(html.includes("Open level 5100 GBP"), false);
});

test("expired and failed connections offer reconnect while retaining disconnect", () => {
  const old = snapshot();
  for (const props of [
    { snapshot: { ...old, expiresAt: new Date(0).toISOString() } },
    { snapshot: old, message: "UNAVAILABLE" as const },
  ]) {
    const html = renderToStaticMarkup(createElement(IgDemoPositionPanel, { ...props, enabled: true, onConnect() {}, onDisconnect() {} }));
    assert.ok(html.includes("Reconnect IG DEMO account"));
    assert.ok(html.includes("Disconnect DEMO"));
    assert.equal(html.includes("Refresh DEMO"), false);
  }
});

test("request loading, failures and expiry suppress previously observed position data", () => {
  const old = snapshot();
  for (const props of [
    { snapshot: old, busy: true },
    { snapshot: old, message: "UNAVAILABLE" as const },
    { snapshot: old, message: "CANCELLED" as const },
    { snapshot: { ...old, expiresAt: new Date(0).toISOString() } },
    { snapshot: { ...old, expiresAt: "invalid" } },
  ]) {
    const html = renderToStaticMarkup(createElement(IgDemoPositionPanel, { ...props, enabled: true }));
    assert.equal(html.includes("IX.D.SPTRD.DAILY.IP"), false);
    assert.equal(html.includes("Open level 5100"), false);
  }
});

test("empty verified portfolio and disconnected state are distinct", () => {
  const connected = snapshot();
  const empty = renderToStaticMarkup(createElement(IgDemoPositionPanel, { enabled: true, snapshot: { ...connected, positions: [] } }));
  const disconnected = renderToStaticMarkup(createElement(IgDemoPositionPanel, { enabled: true, snapshot: null }));
  assert.ok(empty.includes("No open positions were returned"));
  assert.ok(disconnected.includes("No DEMO account connected"));
  assert.ok(disconnected.includes("Connect existing IG DEMO account"));
  assert.equal(disconnected.includes("No open positions were returned"), false);
});
