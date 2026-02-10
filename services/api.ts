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
