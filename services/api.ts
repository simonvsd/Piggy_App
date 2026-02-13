const API_BASE = "http://192.168.0.171:8080";

export type Snapshot = {
  cash: number;
  realized_pnl: number;
  total_equity: number;
  positions: Position[];
};

export type Position = {
  symbol: string;
  quantity: number;
  avg_price: number;
  market_price: number;
  current_price: number;
  unrealized_pnl: number;
};

export async function getSnapshot(): Promise<Snapshot> {
  const url = `${API_BASE}/portfolio/snapshot`;

  console.log("GET SNAPSHOT → URL:", url);

  const res = await fetch(url);

  console.log("GET SNAPSHOT → response status:", res.status);

  const text = await res.text();

  console.log("GET SNAPSHOT → raw body:", text);

  if (!res.ok) {
    throw new Error(`Snapshot failed: ${res.status} ${text}`);
  }

  return JSON.parse(text);
}

export async function getEquitySeries(): Promise<{ timestamp: number; total_equity: number }[]> {
  const url = `${API_BASE}/portfolio/equity_series`;

  console.log("EQUITY SERIES → URL:", url);

  const res = await fetch(url);

  console.log("EQUITY SERIES → status:", res.status);

  const text = await res.text();

  console.log("EQUITY SERIES → raw body:", text);

  if (!res.ok) {
    throw new Error("Failed to load equity series");
  }

  const data = JSON.parse(text);

  console.log("EQUITY SERIES → parsed:", data);

  return data.series ?? [];
}


export async function getPositions(): Promise<Position[]> {
  const res = await fetch(`${API_BASE}/portfolio/positions`);
  if (!res.ok) throw new Error("Failed to load positions");
  const data = await res.json();
  return data.positions;
}

export async function placeTrade(symbol: string, side: "BUY" | "SELL", quantity: number) {

  const url = `${API_BASE}/trade`;
  console.log("PLACE TRADE → URL:", url);
  console.log("PLACE TRADE → payload:", { symbol, side, quantity });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, side, quantity })
  });

  console.log("PLACE TRADE → response status:", res.status);

  const data = await res.json();

  console.log("PLACE TRADE → response body:", data);

  if (!res.ok) {
    throw new Error(data.error || "Trade failed");
  }

  return data;
}

/** List entry from GET /market/symbols: { symbol, name } */
export type SymbolOption = { symbol: string; name: string };

/** Returns symbol list from GET /market/symbols. Empty array if endpoint missing or fails. */
export async function getSymbolList(): Promise<SymbolOption[]> {
  try {
    const res = await fetch(`${API_BASE}/market/symbols`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.symbols ?? data.list ?? (Array.isArray(data) ? data : []);
    if (!Array.isArray(list)) return [];
    return list
      .map((item: unknown): SymbolOption | null => {
        if (item == null) return null;
        if (typeof item === "string") {
          return { symbol: item, name: item };
        }
        if (typeof item === "object" && typeof (item as { symbol?: unknown }).symbol === "string") {
          const o = item as { symbol: string; name?: string };
          return {
            symbol: String(o.symbol),
            name: typeof o.name === "string" ? o.name : String(o.symbol),
          };
        }
        return null;
      })
      .filter((s): s is SymbolOption => s != null)
      .slice(0, 1000);
  } catch {
    return [];
  }
}

export async function loadSymbol(symbol: string) {
  const res = await fetch(`${API_BASE}/market/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load symbol");
  }

  return data;
}

export async function refreshMarket(): Promise<Snapshot> {
  const res = await fetch(`${API_BASE}/market/refresh`, {
    method: "POST",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to refresh market");
  }

  return data;
}

export async function addCash(amount: number): Promise<Snapshot | void> {
  const res = await fetch(`${API_BASE}/portfolio/add_cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Failed to add cash";
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  if (!text || text.trim() === "") return;
  try {
    return JSON.parse(text) as Snapshot;
  } catch {
    return;
  }
}

export async function removeCash(amount: number): Promise<Snapshot | void> {
  const res = await fetch(`${API_BASE}/portfolio/remove_cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Failed to remove cash";
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data.error || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  if (!text || text.trim() === "") return;
  try {
    return JSON.parse(text) as Snapshot;
  } catch {
    return;
  }
}

export type MarketHistoryPoint = { timestamp: number; close: number };

/**
 * Use the symbol exactly as given by the backend (e.g. NOVN.SW, 0xBTC-USD.CC).
 * Only trim whitespace and URL-encode for the request.
 */
export async function getMarketHistory(symbol: string): Promise<MarketHistoryPoint[]> {
  const encoded = encodeURIComponent(symbol.trim());
  const res = await fetch(`${API_BASE}/market/history?symbol=${encoded}`);

  console.log("RAW MARKET HISTORY STATUS:", res.status);

  let data: { series?: unknown; prices?: unknown } | unknown;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) return [];
    throw new Error("Invalid response");
  }

  console.log("RAW MARKET HISTORY RESPONSE:", data);

  const obj = data && typeof data === "object" && !Array.isArray(data) ? data as { series?: unknown; prices?: unknown } : null;
  const series = Array.isArray(obj?.series)
    ? obj.series as MarketHistoryPoint[]
    : Array.isArray(obj?.prices)
      ? obj.prices as MarketHistoryPoint[]
      : Array.isArray(data)
        ? (data as MarketHistoryPoint[])
        : [];

  if (!res.ok) return series;
  return series;
}

