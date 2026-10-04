import type { EChartsCoreOption } from "echarts/core";
import { useMemo, useRef } from "react";
import { EChart } from "../../components/EChart";
import { dailyAppStacks, rollingAverage } from "../../domain/history";
import type { DailyUsageRow } from "../../domain/types";
import { OTHER_LABEL } from "../../lib/appIdentity";
import { formatDayMedium, formatDayShort, formatDuration, formatPercent } from "../../lib/format";
import { appColor, chromeFor, neutralColor, type ColorMode } from "../../lib/palette";
import { esc, tooltipStyle } from "./chartTheme";

/** How many applications each day breaks out before folding the rest into "Other". */
export const STACK_TOP_N = 5;

interface ClickParams {
  componentType?: string;
  dataIndex?: number;
  seriesName?: string;
  seriesType?: string;
  value?: number;
  color?: string;
}

/**
 * UC-05: a stacked bar per day, split by application.
 *
 * Each day picks its own `STACK_TOP_N` busiest applications, so the legend can
 * list far more than that: an application is a segment on the days it is busy
 * and part of that day's "Other" on the rest. Every day's bar still sums to
 * that day's active time. Clicking a segment narrows the chart to that one
 * application (every other series disappears); clicking it again restores the
 * stack. Idle is not stacked — this chart is about where active time went.
 */
export function HistoryChart({
  rows,
  from,
  to,
  mode,
  filteredApp,
  rolling,
  windowDays,
  onSelectApp,
}: {
  rows: DailyUsageRow[];
  from: number;
  to: number;
  mode: ColorMode;
  filteredApp: string | null;
  rolling: boolean;
  windowDays: number;
  onSelectApp: (app: string | null) => void;
}) {
  const stacks = useMemo(
    () => dailyAppStacks(rows, from, to, STACK_TOP_N, filteredApp),
    [rows, from, to, filteredApp],
  );

  /**
   * The series the cursor is on, or null over empty space.
   *
   * A ref rather than state on purpose: ECharts reads it inside the tooltip
   * formatter while it builds the tooltip, so hover must not re-render React
   * (that is this chart's whole performance contract). One tooltip serves both
   * modes — ECharts cannot mix `item` and `axis` triggers on a single one.
   */
  const hoveredSeries = useRef<string | null>(null);

  const option = useMemo<EChartsCoreOption>(() => {
    const chrome = chromeFor(mode);
    const labels = stacks.days.map((day) => formatDayShort(day));
    const zoomed = stacks.days.length > 60;

    const series: EChartsCoreOption[] = stacks.series.map((entry) => ({
      name: entry.app,
      type: "bar",
      stack: "active",
      barMaxWidth: 20,
      // Deliberately no `emphasis.focus`. "series" blurs every other series
      // while one is hovered, and the blur/unblur animation re-fires on every
      // segment the cursor crosses — which reads as the chart flickering.
      itemStyle: {
        color: entry.app === OTHER_LABEL ? neutralColor(mode) : appColor(entry.app, mode),
      },
      data: entry.values,
    }));

    if (rolling) {
      series.push({
        name: `${windowDays}-day average`,
        type: "line",
        symbol: "none",
        z: 3,
        lineStyle: { color: chrome.ink, width: 1.5 },
        itemStyle: { color: chrome.ink },
        data: rollingAverage(stacks.totals, windowDays),
      });
    }

    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 4, right: 12, top: 28, bottom: zoomed ? 46 : 24, containLabel: true },
      legend: {
        // The per-day selection makes for many series, so scroll rather than wrap.
        type: "scroll",
        top: 0,
        left: 0,
        right: 0,
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 8,
        textStyle: { color: chrome.muted, fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: chrome.axis } },
        axisLabel: { color: chrome.muted, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: chrome.muted,
          fontSize: 11,
          formatter: (value: number) => formatDuration(value),
        },
        splitLine: { lineStyle: { color: chrome.grid } },
      },
      dataZoom: zoomed
        ? [
            { type: "inside", xAxisIndex: 0 },
            {
              type: "slider",
              xAxisIndex: 0,
              height: 16,
              bottom: 2,
              borderColor: chrome.grid,
              fillerColor: "rgba(137,135,129,0.15)",
              handleStyle: { color: chrome.axis },
              textStyle: { color: chrome.muted, fontSize: 10 },
            },
          ]
        : [{ type: "inside", xAxisIndex: 0 }],
      tooltip: {
        // Axis-triggered, so the whole column responds — but the formatter
        // narrows to a single activity when the cursor is actually on a
        // segment, which is what gives the "item over the bar, axis beside it"
        // behaviour from one tooltip.
        trigger: "axis",
        renderMode: "html",
        ...tooltipStyle(mode),
        formatter: (params: ClickParams[]) => {
          const index = params[0]?.dataIndex;
          if (index === undefined) {
            return "";
          }
          const day = `<div style="opacity:0.75;margin-bottom:4px">${esc(
            formatDayMedium(stacks.days[index] ?? 0),
          )}</div>`;

          const hovered = hoveredSeries.current;
          const focused =
            hovered === null ? undefined : params.find((param) => param.seriesName === hovered);

          if (focused !== undefined) {
            if (focused.seriesType === "line") {
              return `${day}<div style="font-weight:600">${esc(
                focused.seriesName ?? "",
              )}</div><div>${formatDuration(focused.value ?? 0)}</div>`;
            }
            const value = focused.value ?? 0;
            const total = stacks.totals[index] ?? 0;
            return [
              day,
              `<div style="font-weight:600;font-size:13px">${esc(focused.seriesName ?? "")}</div>`,
              `<div style="font-weight:600;margin-top:2px">${formatDuration(value)}</div>`,
              `<div style="opacity:0.75">${formatPercent(
                total > 0 ? value / total : 0,
              )} of the day</div>`,
            ].join("");
          }

          // On the column but not on a segment: summarise the whole bar.
          const rowsHtml = params
            .filter((param) => param.seriesType === "bar" && (param.value ?? 0) > 0)
            .map(
              (param) =>
                `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${
                  param.color
                };margin-right:6px"></span>${esc(param.seriesName ?? "")}&nbsp;<b>${formatDuration(
                  param.value ?? 0,
                )}</b></div>`,
            );
          const total = `<div style="opacity:0.75;margin-top:3px">Total ${formatDuration(
            stacks.totals[index] ?? 0,
          )}</div>`;
          return day + rowsHtml.join("") + total;
        },
      },
      series,
    };
  }, [stacks, mode, rolling, windowDays]);

  const onEvents = useMemo(
    () => ({
      // zrender fires `mouseout` before `mouseover` when the hovered element
      // changes, so tracking both leaves the ref on the series under the
      // cursor. `globalout` covers leaving the canvas while still on one.
      mouseover: (params: ClickParams) => {
        if (params.componentType === "series" && params.seriesName !== undefined) {
          hoveredSeries.current = params.seriesName;
        }
      },
      mouseout: () => {
        hoveredSeries.current = null;
      },
      globalout: () => {
        hoveredSeries.current = null;
      },
      click: (params: ClickParams) => {
        // Only a bar segment selects; "Other" is not a single application and
        // the rolling-average line is not an application at all.
        if (params.seriesType !== "bar" || params.seriesName === undefined) {
          return;
        }
        if (params.seriesName === OTHER_LABEL) {
          return;
        }
        onSelectApp(params.seriesName === filteredApp ? null : params.seriesName);
      },
    }),
    [filteredApp, onSelectApp],
  );

  return <EChart option={option} height="100%" onEvents={onEvents} />;
}
