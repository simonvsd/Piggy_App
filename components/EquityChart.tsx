import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

const CARD_PADDING = 20;
const CHART_HEIGHT = 200;
const LINE_COLOR = "#1e88e5";
const COLORS = {
  card: "#ffffff",
  cardBorder: "#e5e5ea",
  textSecondary: "#8e8e93",
};

export type EquitySeriesPoint = { timestamp: number; total_equity: number };

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

function seriesToChartData(series: EquitySeriesPoint[]): { value: number; label: string }[] {
  return series.map((p) => ({
    value: p.total_equity,
    label: formatDate(toMs(p.timestamp)),
  }));
}


type Props = {
  series: EquitySeriesPoint[];
};

export function EquityChart({ series }: Props) {
  if (!series || series.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No history available</Text>
      </View>
    );
  }

  const chartData = seriesToChartData(series);
  const screenWidth = Dimensions.get("window").width;
  const cardContentWidth = screenWidth - 20 * 2 - 20 * 2; // margins + padding
  const chartWidth = Math.max(0, cardContentWidth - 20);   // inset so x-axis stays inside card

  return (
    <View style={styles.card}>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={CHART_HEIGHT}
        color={LINE_COLOR}
        thickness={2}
        curvature={0.2}
        hideDataPoints={chartData.length > 15}
        spacing={chartData.length <= 2 ? Math.max(40, chartWidth / (chartData.length || 1)) : undefined}
        xAxisLabelTextStyle={styles.axisLabel}
       // xAxisLabelCount={Math.min(chartData.length, 5)}
        yAxisTextStyle={styles.axisLabel}
        noOfSections={4}
        hideRules={true}
        showVerticalLines={false}
        yAxisLabelPrefix="$"
      />
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
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  axisLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});
