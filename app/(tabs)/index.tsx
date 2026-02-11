import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EquityChart, type EquitySeriesPoint } from "../../components/EquityChart";
import { formatQuantity } from "@/utils/format";
import { getEquitySeries, getSnapshot, Position, refreshMarket, Snapshot } from "../../services/api";
import { subscribePortfolioChanged } from "../../services/portfolioEvents";


const DEBUG = false;

const COLORS = {
  background: "#B0C4DE",
  card: "#FFFFFF",
  cardBorder: "#grey",
  cardShadow: "rgba(0,0,0,0.06)",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
  positive: "#34c759",
  negative: "#ff3b30",
};

type ChartRange = "1D" | "1W" | "1M" | "1Y";
const CHART_RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y"];
const RANGE_MS: Record<ChartRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 366 * 24 * 60 * 60 * 1000,
};

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;
const EQUITY_CHART_CACHE_MS = 6 * 60 * 60 * 1000; // refresh at max every 6 hours

function filterSeriesByRange(series: EquitySeriesPoint[], range: ChartRange): EquitySeriesPoint[] {
  const cutoffMs = Date.now() - RANGE_MS[range];
  const toMs = (p: EquitySeriesPoint) => (p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000);
  return series
    .filter((p) => toMs(p) >= cutoffMs)
    .sort((a, b) => toMs(a) - toMs(b));
}

/** 1M: one point every 7 days. 1Y: one point per month. 1D/1W: no downsampling. */
function downsampleEquityByRange(series: EquitySeriesPoint[], range: ChartRange): EquitySeriesPoint[] {
  if (series.length === 0) return series;
  if (range === "1D" || range === "1W") return series;

  const toSec = (p: EquitySeriesPoint) => (p.timestamp > 1e12 ? p.timestamp / 1000 : p.timestamp);
  const toMs = (p: EquitySeriesPoint) => (p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000);

  if (range === "1M") {
    const bucketMap = new Map<number, EquitySeriesPoint>();
    for (const p of series) {
      const bucket = Math.floor(toSec(p) / SEVEN_DAYS_SEC);
      const existing = bucketMap.get(bucket);
      if (!existing || toSec(p) > toSec(existing)) {
        bucketMap.set(bucket, p);
      }
    }
    return Array.from(bucketMap.values()).sort((a, b) => toSec(a) - toSec(b));
  }

  if (range === "1Y") {
    const bucketMap = new Map<number, EquitySeriesPoint>();
    for (const p of series) {
      const d = new Date(toMs(p));
      const bucket = d.getFullYear() * 12 + d.getMonth();
      const existing = bucketMap.get(bucket);
      if (!existing || toMs(p) > toMs(existing)) {
        bucketMap.set(bucket, p);
      }
    }
    return Array.from(bucketMap.values()).sort((a, b) => toMs(a) - toMs(b));
  }

  return series;
}

function prepareChartData(series: EquitySeriesPoint[], range: ChartRange): EquitySeriesPoint[] {
  const filtered = filterSeriesByRange(series, range);
  return downsampleEquityByRange(filtered, range);
}


export default function HomeScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [series, setSeries] = useState<EquitySeriesPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartRange, setChartRange] = useState<ChartRange>("1M");
  const lastEquityFetchRef = useRef<number>(0);
  const lastEquityValueRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (DEBUG) console.log("[Home] load() started");
    try {
      setLoading(true);
      const data = await getSnapshot();
      if (DEBUG) console.log("[Home] load() completed", { cash: data.cash, positionsCount: data.positions?.length });
      setSnapshot(data);

      const now = Date.now();
      const equityChanged = data.total_equity !== lastEquityValueRef.current;
      const shouldFetchEquity =
        lastEquityFetchRef.current === 0 ||
        now - lastEquityFetchRef.current >= EQUITY_CHART_CACHE_MS ||
        equityChanged;

      if (shouldFetchEquity) {
        setChartLoading(true);
        try {
          const eq = await getEquitySeries();
          setSeries(eq ?? []);
          lastEquityFetchRef.current = Date.now();
          lastEquityValueRef.current = data.total_equity;
        } catch (e) {
          console.error("Chart load error", e);
          setSeries([]);
        } finally {
          setChartLoading(false);
        }
      } else {
        setChartLoading(false);
      }
    } catch (err) {
      console.error("[Home] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefreshMarket = useCallback(async () => {
    try {
      setLoading(true);
      await refreshMarket();   // call backend refresh
      await load();            // reload snapshot + chart
    } catch (err: any) {
      console.error("Market refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [load]);
  

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    if (DEBUG) console.log("[Home] mount");
    return () => {
      if (DEBUG) console.log("[Home] unmount");
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribePortfolioChanged(() => {
      if (DEBUG) console.log("[Home] portfolioChanged received, refreshing");
      load();
    });
    return () => unsub();
  }, [load]);

  if (loading && !snapshot) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.textSecondary} />
        <Text style={styles.loadingText}>Loading portfolio…</Text>
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Error loading portfolio</Text>
      </View>
    );
  }

  const positions = snapshot.positions ?? [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textSecondary} />
        }
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>🐷 Piggy Bank</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Equity</Text>
          <Text style={styles.totalEquity}>${snapshot.total_equity.toFixed(2)}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summarySecondary}>Cash</Text>
            <Text style={styles.summaryValue}>${snapshot.cash.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summarySecondary}>Realized P&L</Text>
            <Text style={[styles.summaryValue, snapshot.realized_pnl >= 0 ? styles.positive : styles.negative]}>
              ${snapshot.realized_pnl.toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshMarket}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Total Equity</Text>

        <View style={chartLoading ? styles.chartCard : undefined}>
          {chartLoading ? (
            <>
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
              <Text style={styles.chartLoadingText}>Loading chart…</Text>
            </>
          ) : (
            <>
              <View style={styles.chartRangeRow}>
                {CHART_RANGES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setChartRange(r)}
                    style={[styles.chartRangeButton, chartRange === r && styles.chartRangeButtonActive]}
                  >
                    <Text style={[styles.chartRangeLabel, chartRange === r && styles.chartRangeLabelActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <EquityChart series={prepareChartData(series, chartRange)} range={chartRange} />
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Positions</Text>

        {positions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No positions</Text>
            <Text style={styles.emptySubtext}>Place a trade to see positions here.</Text>
          </View>
        ) : (
          <View style={styles.listContent}>
            {positions.map((item) => (
              <PositionRow
                key={item.symbol}
                p={item}
                onPress={() => router.push((`/position/${item.symbol}`) as Parameters<typeof router.push>[0])}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PositionRow({ p, onPress }: { p: Position; onPress: () => void }) {
  const pnlColor =
    p.unrealized_pnl > 0
      ? COLORS.positive
      : p.unrealized_pnl < 0
      ? COLORS.negative
      : COLORS.text;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View>
        <Text style={styles.rowSymbol}>
          {p.symbol} (${p.current_price.toFixed(2)})
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowQty}>Qty {formatQuantity(p.quantity)}</Text>
        <Text style={[styles.rowPnl, { color: pnlColor }]}>
          {p.unrealized_pnl >= 0 ? "+" : ""}${p.unrealized_pnl.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.negative,
  },
  header: {
    alignItems: 'center',      // horizontal centering
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  totalEquity: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summarySecondary: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  positive: {
    color: COLORS.positive,
  },
  negative: {
    color: COLORS.negative,
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  chartLoadingText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  chartRangeRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  chartRangeButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
  },
  chartRangeButtonActive: {
    backgroundColor: "#1e88e5",
    borderColor: "#1e88e5",
  },
  chartRangeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  chartRangeLabelActive: {
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  rowSymbol: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowQty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  rowPnl: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  refreshButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e88e5",
    alignItems: "center",
  },
  
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },  
});
