import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

const CARD_PADDING = 20;
const CHART_HEIGHT = 200;
const CHART_INSET = 32; // space from card edge – line, rules, and x-axis stay inside
const LINE_COLOR = "blue"; // pig emoji pink (matches Home accent)
const COLORS = {
  card: "#ffffff",
  cardBorder: "#e5e5ea",
  textSecondary: "#8e8e93",
};

export type EquitySeriesPoint = { timestamp: number; total_equity: number };

export type ChartRange = "1D" | "1W" | "1M" | "1Y";

function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

function formatLabel(tsMs: number, range: ChartRange): string {
  const d = new Date(tsMs);
  if (range === "1D") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (range === "1W") {
    return d.toLocaleDateString(undefined, { weekday: "short" }); // e.g. "Mon", "Tue"
  }
  if (range === "1M") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // e.g. "Jan 9"
  }
  // 1Y: month only
  return d.toLocaleDateString(undefined, { month: "short" }); // e.g. "Jan", "Feb"
}

function seriesToChartData(
  series: EquitySeriesPoint[],
  range: ChartRange,
  hidePointLabels: boolean
): { value: number; label: string }[] {
  return series.map((p) => ({
    value: p.total_equity,
    label: hidePointLabels ? "" : formatLabel(toMs(p.timestamp), range),
  }));
}

type Props = {
  series: EquitySeriesPoint[];
  range?: ChartRange;
};

export function EquityChart({ series, range = "1M" }: Props) {
  if (!series || series.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No history available</Text>
      </View>
    );
  }

  const is1D = range === "1D";
  const is1W = range === "1W";
  const pointCount = series.length;
  const hide1DXLabels = is1D && pointCount > 6;
  const hide1WXLabels = is1W && pointCount > 7;
  const hidePointLabels = hide1DXLabels || hide1WXLabels;
  const chartData = seriesToChartData(series, range, hidePointLabels);

  const screenWidth = Dimensions.get("window").width;
  const cardContentWidth = screenWidth - 20 * 2 - 20 * 2; // margins + padding
  const innerChartWidth = Math.max(0, cardContentWidth - CHART_INSET * 2);

  // Squish along x-axis so all points fit inside inset for every range (1D, 1W, 1M, 1Y)
  const spacing =
    pointCount > 1
      ? innerChartWidth / pointCount
      : Math.max(40, innerChartWidth / (pointCount || 1));

  return (
    <View style={styles.card}>
      <View style={[styles.chartInset, { paddingHorizontal: CHART_INSET }]}>
        <LineChart
          data={chartData}
          width={innerChartWidth}
          height={CHART_HEIGHT}
          color={LINE_COLOR}
          thickness={2}
          curvature={0.2}
          hideDataPoints={chartData.length > 15}
          spacing={spacing}
          xAxisLabelTextStyle={
            (is1D && pointCount > 30 && !hide1DXLabels) || (!is1D && pointCount > 12)
              ? [styles.axisLabel, styles.axisLabelSmall]
              : styles.axisLabel
          }
          yAxisTextStyle={styles.axisLabel}
          yAxisLabelPrefix="$"
          yAxisLabelContainerStyle={{ marginRight: 10 }}
          hideRules={false}
          rulesType="solid"
          rulesColor="rgba(0,0,0,0.10)"
          rulesThickness={1}
          noOfSections={6}
          showVerticalLines={false}
          xAxisLabelsHeight={22}
        />
      </View>
      {hide1DXLabels && (
        <Text style={styles.centeredAxisLabel}>Today</Text>
      )}
      {hide1WXLabels && (
        <Text style={styles.centeredAxisLabel}>Week</Text>
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
    minHeight: CHART_HEIGHT + 40,
    overflow: "hidden",
  },
  chartInset: {
    width: "125%",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  axisLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  axisLabelSmall: {
    fontSize: 9,
  },
  centeredAxisLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: -11,
    alignSelf: "center",
  },
});
