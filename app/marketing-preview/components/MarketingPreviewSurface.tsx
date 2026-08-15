"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MARKETING_PREVIEW_STATES,
  getMarketingPreviewFixture,
  type MarketingPreviewStateId,
} from "../lib/illustrative-fixtures.ts";
import {
  MARKETING_PREVIEW_PAGES,
  getMarketingPreviewPage,
  type MarketingPreviewPageId,
} from "../lib/page-sections.ts";
import { MarketingPreviewPageContent } from "./MarketingPreviewPages.tsx";

function sessionClockLabel() {
  return "21 Jul 2026 · 15:55 UK · Example session";
}

function replacePreviewQuery(key: "state" | "view", value: string, defaultValue?: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === defaultValue) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

export function MarketingPreviewSurface({
  initialState = "wait",
  initialPage = "dashboard",
}: {
  initialState?: MarketingPreviewStateId;
  initialPage?: MarketingPreviewPageId;
}) {
  const [stateId, setStateId] = useState<MarketingPreviewStateId>(initialState);
  const [pageId, setPageId] = useState<MarketingPreviewPageId>(initialPage);
  const fixture = useMemo(() => getMarketingPreviewFixture(stateId), [stateId]);
  const page = getMarketingPreviewPage(pageId);

  function selectPage(nextPage: MarketingPreviewPageId) {
    setPageId(nextPage);
    replacePreviewQuery("view", nextPage, "dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectState(nextState: MarketingPreviewStateId) {
    setStateId(nextState);
    replacePreviewQuery("state", nextState, "wait");
  }

  return (
    <div className="mpShell" data-marketing-preview="illustrative" data-state={fixture.id} data-page={pageId}>
      <aside className="mpSidebar" aria-label="Illustrative Bullseye navigation">
        <div className="mpBrand">
          <Image src="/brand/logo-mark.svg" width={36} height={36} alt="" aria-hidden="true" />
          <div><strong>BULLSEYE</strong><span>NASH AI Markets</span></div>
        </div>
        <nav className="mpNav">
          {MARKETING_PREVIEW_PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === pageId ? "is-active" : undefined}
              aria-current={item.id === pageId ? "page" : undefined}
              onClick={() => selectPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mpSidebarFoot">
          <span>ILLUSTRATIVE SESSION SNAPSHOT</span>
          <strong>Full example workspace</strong>
          <small>Illustrative content · no account or live market data</small>
        </div>
      </aside>

      <div className="mpMain">
        <div className="mpGlobalDemoBanner" role="status">
          <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
          <span>Every figure, chart, profile and idea on this preview is illustrative.</span>
        </div>
        <header className="mpTopBar">
          <div><span className="mpEyebrow">{page.eyebrow}</span><h1>{page.title}</h1></div>
          <div className="mpTopMeta">
            <span className="mpSessionPill">{sessionClockLabel()}</span>
            <div className="mpStateSwitcher" role="tablist" aria-label="Illustrative screenshot states">
              {MARKETING_PREVIEW_STATES.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={stateId === id} className={stateId === id ? "is-active" : undefined} onClick={() => selectState(id)}>
                  {getMarketingPreviewFixture(id).label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <MarketingPreviewPageContent pageId={pageId} fixture={fixture} onNavigate={selectPage} />

        <footer className="mpFooter">
          <p>Illustrative session data for product demonstration. Not live market data and not financial advice.</p>
          <div><button type="button" onClick={() => selectPage("dashboard")}>Example Dashboard</button><Link href="/">NASH AI Markets home</Link></div>
        </footer>
      </div>
    </div>
  );
}
