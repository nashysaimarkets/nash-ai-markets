/**
 * Preferred trading platforms — deep links + optional safe public embeds.
 * No broker OAuth, no order routing, no credentials, no invented fills.
 */

import type { MarketGroupId, MarketInstrument } from "../../lib/markets/market-catalog.ts";

export const PREFERRED_PLATFORM_IDS = [
  "tradingview",
  "interactive-brokers",
  "thinkorswim",
  "webull",
  "robinhood",
  "metatrader",
  "ctrader",
  "coinbase",
  "binance",
  "external",
] as const;

export type PreferredPlatformId = (typeof PREFERRED_PLATFORM_IDS)[number];

export type PlatformAssetClass =
  | "indices"
  | "fx"
  | "crypto"
  | "shares"
  | "commodities"
  | "bonds"
  | "etfs"
  | "other";

export type PlatformLaunchResult =
  | {
      status: "ready";
      url: string;
      label: string;
      detail: string;
    }
  | {
      status: "unavailable";
      label: string;
      reason: string;
    };

export type PlatformEmbedResult =
  | {
      status: "ready";
      src: string;
      title: string;
      detail: string;
    }
  | {
      status: "unavailable";
      reason: string;
    };

export type PreferredPlatform = {
  id: PreferredPlatformId;
  label: string;
  shortLabel: string;
  description: string;
  homepage: string;
  /** Asset classes with a known public URL scheme. */
  supportedClasses: readonly PlatformAssetClass[];
  supportsEmbed: boolean;
};

const GROUP_TO_CLASS: Record<MarketGroupId, PlatformAssetClass> = {
  indices: "indices",
  fx: "fx",
  cryptocurrency: "crypto",
  shares: "shares",
  commodities: "commodities",
  bonds_and_rates: "bonds",
  etfs: "etfs",
  ipos: "other",
};

export const PREFERRED_PLATFORMS: Record<PreferredPlatformId, PreferredPlatform> = {
  tradingview: {
    id: "tradingview",
    label: "TradingView",
    shortLabel: "TradingView",
    description: "Public chart deep link and optional sandboxed Advanced Chart embed.",
    homepage: "https://www.tradingview.com/",
    supportedClasses: ["indices", "fx", "crypto", "shares", "commodities", "bonds", "etfs"],
    supportsEmbed: true,
  },
  "interactive-brokers": {
    id: "interactive-brokers",
    label: "Interactive Brokers",
    shortLabel: "IBKR",
    description: "Opens IBKR Client Portal / quote search for the active symbol when mapped.",
    homepage: "https://www.interactivebrokers.com/",
    supportedClasses: ["shares", "etfs", "indices", "fx", "commodities", "bonds"],
    supportsEmbed: false,
  },
  thinkorswim: {
    id: "thinkorswim",
    label: "thinkorswim / TD Ameritrade",
    shortLabel: "thinkorswim",
    description: "Public Schwab / thinkorswim research deep link for equities and ETFs.",
    homepage: "https://www.schwab.com/",
    supportedClasses: ["shares", "etfs"],
    supportsEmbed: false,
  },
  webull: {
    id: "webull",
    label: "Webull",
    shortLabel: "Webull",
    description: "Public Webull quote page for equities and ETFs.",
    homepage: "https://www.webull.com/",
    supportedClasses: ["shares", "etfs"],
    supportsEmbed: false,
  },
  robinhood: {
    id: "robinhood",
    label: "Robinhood",
    shortLabel: "Robinhood",
    description: "Public Robinhood stock page for equities and ETFs.",
    homepage: "https://robinhood.com/",
    supportedClasses: ["shares", "etfs"],
    supportsEmbed: false,
  },
  metatrader: {
    id: "metatrader",
    label: "MetaTrader",
    shortLabel: "MetaTrader",
    description: "FX / CFD oriented — deep link to MQL5 symbol search when a FX pair is active.",
    homepage: "https://www.metatrader5.com/",
    supportedClasses: ["fx", "commodities", "indices"],
    supportsEmbed: false,
  },
  ctrader: {
    id: "ctrader",
    label: "cTrader",
    shortLabel: "cTrader",
    description: "FX-focused public cTrader site — opens platform homepage with symbol hint.",
    homepage: "https://ctrader.com/",
    supportedClasses: ["fx"],
    supportsEmbed: false,
  },
  coinbase: {
    id: "coinbase",
    label: "Coinbase",
    shortLabel: "Coinbase",
    description: "Public Coinbase asset page for mapped crypto symbols.",
    homepage: "https://www.coinbase.com/",
    supportedClasses: ["crypto"],
    supportsEmbed: false,
  },
  binance: {
    id: "binance",
    label: "Binance",
    shortLabel: "Binance",
    description: "Public Binance spot trade deep link for mapped crypto pairs.",
    homepage: "https://www.binance.com/",
    supportedClasses: ["crypto"],
    supportsEmbed: false,
  },
  external: {
    id: "external",
    label: "External broker",
    shortLabel: "External",
    description: "Custom URL template — use {SYMBOL} or {NAME} placeholders. No credentials stored.",
    homepage: "",
    supportedClasses: ["indices", "fx", "crypto", "shares", "commodities", "bonds", "etfs", "other"],
    supportsEmbed: false,
  },
};

export function isPreferredPlatformId(value: string): value is PreferredPlatformId {
  return (PREFERRED_PLATFORM_IDS as readonly string[]).includes(value);
}

export function assetClassForInstrument(instrument: MarketInstrument): PlatformAssetClass {
  return GROUP_TO_CLASS[instrument.group] ?? "other";
}

/** Best-effort public TradingView symbol — never claims exchange certification. */
export function tradingViewSymbol(instrument: MarketInstrument): string | null {
  const provider = (instrument.providerSymbol ?? instrument.symbol).trim();
  if (!provider) return null;
  switch (instrument.group) {
    case "fx":
      return `FX:${instrument.symbol}`;
    case "cryptocurrency": {
      const base = instrument.symbol.replace(/USD$/i, "");
      return `BINANCE:${base}USDT`;
    }
    case "etfs":
    case "shares":
      return provider.includes(":") ? provider : `NASDAQ:${provider.replace(/\./g, "-")}`;
    case "indices":
      if (instrument.symbol === "ES") return "CME_MINI:ES1!";
      if (instrument.symbol === "NQ") return "NASDAQ:IXIC";
      if (instrument.symbol === "VIX") return "CBOE:VIX";
      if (instrument.symbol === "DXY") return "TVC:DXY";
      if (provider.startsWith("^")) return `TVC:${provider.slice(1)}`;
      return provider.includes(":") ? provider : `TVC:${provider}`;
    case "commodities":
      if (instrument.symbol === "OIL" || instrument.symbol === "USO") return "AMEX:USO";
      if (instrument.symbol === "GOLD") return "TVC:GOLD";
      if (instrument.symbol === "SILVER") return "TVC:SILVER";
      return provider.includes(":") ? provider : `TVC:${provider}`;
    case "bonds_and_rates":
      if (instrument.symbol === "TLT" || instrument.symbol === "IEF" || instrument.symbol === "SHY") {
        return `NASDAQ:${instrument.symbol}`;
      }
      if (instrument.symbol === "US10Y" || instrument.symbol === "TNX") return "TVC:US10Y";
      if (instrument.symbol === "US2Y") return "TVC:US02Y";
      return provider.includes(":") ? provider : `TVC:${provider}`;
    default:
      return null;
  }
}

function equitySymbol(instrument: MarketInstrument): string | null {
  if (instrument.group !== "shares" && instrument.group !== "etfs") return null;
  return instrument.symbol.replace(/\./g, "-");
}

function cryptoSlug(instrument: MarketInstrument): string | null {
  if (instrument.group !== "cryptocurrency") return null;
  const map: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    XRP: "xrp",
    BNB: "bnb",
    ADA: "cardano",
    AVAX: "avalanche",
    DOT: "polkadot",
    LINK: "chainlink",
    DOGE: "dogecoin",
    LTC: "litecoin",
    MATIC: "polygon",
  };
  return map[instrument.symbol] ?? instrument.symbol.toLowerCase();
}

function applyExternalTemplate(template: string, instrument: MarketInstrument): string | null {
  const trimmed = template.trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  const symbol = encodeURIComponent(instrument.symbol);
  const name = encodeURIComponent(instrument.name);
  const provider = encodeURIComponent(instrument.providerSymbol ?? instrument.symbol);
  return trimmed
    .replaceAll("{SYMBOL}", symbol)
    .replaceAll("{symbol}", symbol)
    .replaceAll("{NAME}", name)
    .replaceAll("{name}", name)
    .replaceAll("{PROVIDER}", provider)
    .replaceAll("{provider}", provider);
}

export function resolvePlatformLaunch(
  platformId: PreferredPlatformId,
  instrument: MarketInstrument,
  externalTemplate = "",
): PlatformLaunchResult {
  const platform = PREFERRED_PLATFORMS[platformId];
  const assetClass = assetClassForInstrument(instrument);

  if (platformId === "external") {
    const url = applyExternalTemplate(externalTemplate, instrument);
    if (!url) {
      return {
        status: "unavailable",
        label: platform.label,
        reason:
          "Add an https:// URL template with {SYMBOL} or {NAME} in Desk Builder. Broker credentials are never stored.",
      };
    }
    return {
      status: "ready",
      url,
      label: platform.label,
      detail: "Custom external deep link — opens in a new tab. No broker login is performed by NASH AI Markets.",
    };
  }

  if (!platform.supportedClasses.includes(assetClass)) {
    return {
      status: "unavailable",
      label: platform.label,
      reason: `${platform.label} has no known public URL template for ${assetClass} (${instrument.symbol}).`,
    };
  }

  switch (platformId) {
    case "tradingview": {
      const tv = tradingViewSymbol(instrument);
      if (!tv) {
        return {
          status: "unavailable",
          label: platform.label,
          reason: `No TradingView symbol mapping for ${instrument.symbol}.`,
        };
      }
      return {
        status: "ready",
        url: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`,
        label: platform.label,
        detail: `Opens TradingView chart for ${tv}. Third-party site — not an in-app broker session.`,
      };
    }
    case "interactive-brokers": {
      const query = encodeURIComponent(instrument.symbol);
      return {
        status: "ready",
        url: `https://www.interactivebrokers.com/en/trading/products-screener.php#/search=${query}`,
        label: platform.label,
        detail: "Opens IBKR public product search. No order routing or account login via NASH.",
      };
    }
    case "thinkorswim": {
      const symbol = equitySymbol(instrument);
      if (!symbol) {
        return {
          status: "unavailable",
          label: platform.label,
          reason: "thinkorswim public research links are mapped for shares and ETFs only.",
        };
      }
      return {
        status: "ready",
        url: `https://www.schwab.com/research/stocks/${encodeURIComponent(symbol)}`,
        label: platform.label,
        detail: "Opens Schwab public research for the symbol. Not thinkorswim desktop automation.",
      };
    }
    case "webull": {
      const symbol = equitySymbol(instrument);
      if (!symbol) {
        return {
          status: "unavailable",
          label: platform.label,
          reason: "Webull public quote links are mapped for shares and ETFs only.",
        };
      }
      return {
        status: "ready",
        url: `https://www.webull.com/quote/${encodeURIComponent(symbol)}`,
        label: platform.label,
        detail: "Opens Webull public quote page in a new tab.",
      };
    }
    case "robinhood": {
      const symbol = equitySymbol(instrument);
      if (!symbol) {
        return {
          status: "unavailable",
          label: platform.label,
          reason: "Robinhood public stock pages are mapped for shares and ETFs only.",
        };
      }
      return {
        status: "ready",
        url: `https://robinhood.com/stocks/${encodeURIComponent(symbol)}`,
        label: platform.label,
        detail: "Opens Robinhood public stock page. No brokerage session is created here.",
      };
    }
    case "metatrader": {
      const query = encodeURIComponent(instrument.symbol);
      return {
        status: "ready",
        url: `https://www.mql5.com/en/market/product_list?search=${query}`,
        label: platform.label,
        detail: "Opens MQL5 public search. MetaTrader terminals are not controlled from this desk.",
      };
    }
    case "ctrader":
      return {
        status: "ready",
        url: `https://ctrader.com/?utm_source=nash&symbol=${encodeURIComponent(instrument.symbol)}`,
        label: platform.label,
        detail: "Opens cTrader public site with a symbol hint. No account bridge.",
      };
    case "coinbase": {
      const slug = cryptoSlug(instrument);
      if (!slug) {
        return {
          status: "unavailable",
          label: platform.label,
          reason: "Coinbase public asset pages are mapped for cryptocurrency rows only.",
        };
      }
      return {
        status: "ready",
        url: `https://www.coinbase.com/price/${encodeURIComponent(slug)}`,
        label: platform.label,
        detail: "Opens Coinbase public price page. No exchange API keys are used.",
      };
    }
    case "binance": {
      if (instrument.group !== "cryptocurrency") {
        return {
          status: "unavailable",
          label: platform.label,
          reason: "Binance spot deep links are mapped for cryptocurrency rows only.",
        };
      }
      const pair = `${instrument.symbol}USDT`;
      return {
        status: "ready",
        url: `https://www.binance.com/en/trade/${encodeURIComponent(pair)}`,
        label: platform.label,
        detail: "Opens Binance public spot trade page. No API keys or order placement.",
      };
    }
    default:
      return {
        status: "unavailable",
        label: platform.label,
        reason: "No launch template is configured for this platform.",
      };
  }
}

/**
 * Optional TradingView Advanced Chart embed — public widget only.
 * Sandboxed iframe; no API keys; clearly third-party.
 */
export function resolvePlatformEmbed(
  platformId: PreferredPlatformId,
  instrument: MarketInstrument,
): PlatformEmbedResult {
  if (platformId !== "tradingview") {
    return {
      status: "unavailable",
      reason: `${PREFERRED_PLATFORMS[platformId].label} does not offer a safe public chart embed in this desk.`,
    };
  }
  const tv = tradingViewSymbol(instrument);
  if (!tv) {
    return {
      status: "unavailable",
      reason: `No TradingView symbol mapping for ${instrument.symbol}. Embed stays closed.`,
    };
  }
  const src =
    `https://s.tradingview.com/widgetembed/?frameElementId=nash_tv_embed` +
    `&symbol=${encodeURIComponent(tv)}` +
    `&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=0` +
    `&toolbarbg=0b1210&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC` +
    `&withdateranges=1&hideideas=1&hidevolume=0&hidelegend=0`;
  return {
    status: "ready",
    src,
    title: `TradingView chart for ${tv}`,
    detail:
      "Third-party TradingView embed — sandboxed, no NASH API keys, not a live broker ticket. Prices inside the iframe are TradingView’s, not the verified FMP desk feed.",
  };
}
