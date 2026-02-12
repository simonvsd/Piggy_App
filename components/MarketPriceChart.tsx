import React, { useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

const CARD_PADDING = 20;
const CHART_HEIGHT = 200;
const X_AXIS_LABEL_HEIGHT = 36;
const LINE_COLOR = "#1e88e5";
const COLORS = {
  card: "#ffffff",
  cardBorder: "#black",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
};

export type MarketPricePoint = { timestamp: number; close: number };

export type ChartRange = "1D" | "1W" | "1M" | "1Y";
const CHART_RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y"];
const RANGE_MS: Record<ChartRange, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 366 * 24 * 60 * 60 * 1000, // full 12 months
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

/** Normalize to seconds (API may return seconds or milliseconds). */
function toSec(p: MarketPricePoint): number {
  return p.timestamp > 1e12 ? p.timestamp / 1000 : p.timestamp;
}

function filterByRange(series: MarketPricePoint[], range: ChartRange): MarketPricePoint[] {
  const cutoffMs = Date.now() - RANGE_MS[range];
  const cutoffSec = cutoffMs / 1000;
  return series
    .filter((p) => toSec(p) >= cutoffSec)
    .sort((a, b) => toSec(a) - toSec(b));
}

/** 1M: one point every 7 days. 1Y: one point per month. 1D/1W: no downsampling. */
function downsampleForRange(series: MarketPricePoint[], range: ChartRange): MarketPricePoint[] {
  if (series.length === 0) return series;
  if (range === "1D" || range === "1W") return series;

  if (range === "1M") {
    const bucketMap = new Map<number, MarketPricePoint>();
    const sec = (p: MarketPricePoint) => (p.timestamp > 1e12 ? p.timestamp / 1000 : p.timestamp);
    for (const p of series) {
      const bucket = Math.floor(sec(p) / SEVEN_DAYS_SEC);
      const existing = bucketMap.get(bucket);
      if (!existing || sec(p) > sec(existing)) {
        bucketMap.set(bucket, p);
      }
    }
    return Array.from(bucketMap.values()).sort((a, b) => sec(a) - sec(b));
  }

  if (range === "1Y") {
    const bucketMap = new Map<number, MarketPricePoint>();
    const tsMs = (p: MarketPricePoint) => (p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000);
    for (const p of series) {
      const d = new Date(tsMs(p));
      const bucket = d.getFullYear() * 12 + d.getMonth();
      const existing = bucketMap.get(bucket);
      if (!existing || tsMs(p) > tsMs(existing)) {
        bucketMap.set(bucket, p);
      }
    }
    return Array.from(bucketMap.values()).sort((a, b) => tsMs(a) - tsMs(b));
  }

  return series;
}

function seriesToChartData(series: MarketPricePoint[]): { value: number; label: string }[] {
  return series.map((p) => ({
    value: p.close,
    label: formatDate(p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000),
  }));
}

type Props = {
  series: MarketPricePoint[];
};

export function MarketPriceChart({ series }: Props) {
  const [range, setRange] = useState<ChartRange>("1M");

  const filtered = useMemo(() => filterByRange(series, range), [series, range]);
  const downsampled = useMemo(() => downsampleForRange(filtered, range), [filtered, range]);

  if (!series || series.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No price history available for this symbol.</Text>
        <Text style={styles.emptySubtext}>The data provider may not support this symbol or exchange.</Text>
      </View>
    );
  }

  const chartData = seriesToChartData(downsampled);
  const screenWidth = Dimensions.get("window").width;
  const cardContentWidth = screenWidth - 20 * 2 - 20 * 2; // margins + padding
  const chartWidth = Math.max(0, cardContentWidth - 20); // extra inset so x-axis stays inside card

  // Force spacing so chart fits in box (avoids overflow with 1Y / 6+ months of data)
  const pointCount = chartData.length;
  const spacing =
    pointCount <= 2
      ? Math.max(40, chartWidth / (pointCount || 1))
      : chartWidth / Math.max(1, pointCount - 1);

  return (
    <View style={styles.card}>
      <View style={styles.rangeRow}>
        {CHART_RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRange(r)}
            style={[styles.rangeButton, range === r && styles.rangeButtonActive]}
          >
            <Text style={[styles.rangeLabel, range === r && styles.rangeLabelActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {downsampled.length === 0 ? (
        <Text style={styles.emptyText}>No data for this range</Text>
      ) : (
        <View
          style={[
            styles.chartWrapper,
            { width: chartWidth, height: CHART_HEIGHT + X_AXIS_LABEL_HEIGHT },
          ]}
        >
          <LineChart
            data={chartData}
            width={chartWidth}
            height={CHART_HEIGHT}
            color={LINE_COLOR}
            thickness={2}
            curvature={0.2}
            hideDataPoints={chartData.length > 15}
            spacing={spacing}
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            noOfSections={6}
            hideRules={false}
            rulesType="solid"
            rulesColor="rgba(0,0,0,0.10)"
            rulesThickness={1}
            showVerticalLines={false}
            yAxisLabelPrefix="$"
            endSpacing={0}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    minHeight: CHART_HEIGHT + 80,
    overflow: "hidden",
  },
  rangeRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  rangeButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f2f2f7",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
  },
  rangeButtonActive: {
    backgroundColor: LINE_COLOR,
    borderColor: LINE_COLOR,
  },
  rangeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  rangeLabelActive: {
    color: "#fff",
  },
  chartWrapper: {
    overflow: "hidden",
    alignItems: "center",
  },
  chartInset: {
    width: "100%",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  axisLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});
