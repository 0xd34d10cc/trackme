import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "echarts";
import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";
import { EChart } from "../../components/EChart";
import type { DayModel } from "../../lib/hooks/useDayModel";
import { IDLE_LABEL, OTHER_LABEL } from "../../lib/appIdentity";
import { formatClock, formatDuration } from "../../lib/format";
import { appColor, chromeFor } from "../../lib/palette";

/** Lane band fill as a fraction of the lane height — the rest is the 2px+ gap. */
const LANE_FILL = 0.62;
const CORNER = 3;

const ROUNDED: [number, number, number, number] = [CORNER, CORNER, CORNER, CORNER];

interface TimelineItem {
  lane: number;
  begin: number;
  end: number;
  app: string;
  title: string;
  idle: boolean;
  clippedStart: boolean;
  clippedEnd: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * UC-01: the day's activity as a Gantt.
 *
 * One `custom` series draws every interval as a rect on its application's lane.
 * A single series (rather than one per application) keeps the element count and
 * the tooltip pipeline flat, and gives one click handler. Canvas, no animation:
 * this must snap between days, not perform a transition over thousands of rects.
 */
export function TimelineChart({
  model,
  showIdle,
  selectedApp,
  onSelectApp,
}: {
  model: DayModel;
  showIdle: boolean;
  selectedApp: string | null;
  onSelectApp: (app: string | null) => void;
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const chrome = chromeFor(model.mode);

    const laneLabels = model.selectedUsages.map((usage) => usage.app);
    const laneOf = new Map(laneLabels.map((label, index) => [label, index]));
    const otherLane = laneOf.get(OTHER_LABEL) ?? -1;
    const idleLane = showIdle ? laneLabels.length : -1;
    const labels = showIdle ? [...laneLabels, IDLE_LABEL] : laneLabels;

    const items: TimelineItem[] = [];
    for (const interval of model.intervals) {
      if (interval.idle && idleLane < 0) {
        continue;
      }
      const lane = interval.idle
        ? idleLane
        : (laneOf.get(interval.app) ?? otherLane);
      if (lane < 0) {
        continue;
      }
      items.push({
        lane,
        begin: interval.begin,
        end: interval.end,
        app: interval.idle ? IDLE_LABEL : interval.app,
        title: interval.title,
        idle: interval.idle,
        clippedStart: interval.clippedStart,
        clippedEnd: interval.clippedEnd,
      });
    }

    const emphasized = (app: string) =>
      selectedApp === null || app === selectedApp ? 1 : 0.22;

    const colorOf = (item: TimelineItem) => appColor(item.app, model.mode);

    const series: EChartsCoreOption[] = [
      {
        type: "custom",
        // dim 0 = lane, dims 1..2 = the interval, mapped onto the time axis
        encode: { x: [1, 2], y: 0 },
        data: items.map((item) => ({
          value: [item.lane, item.begin, item.end],
          raw: item,
        })),
        animation: false,
        progressive: 1_000,
        progressiveThreshold: 3_000,
        itemStyle: { borderWidth: 0 },
        emphasis: { itemStyle: { opacity: 1 } },
        renderItem: (
          params: CustomSeriesRenderItemParams,
          api: CustomSeriesRenderItemAPI,
        ) => {
          // ECharts 6 does not pass the data item to `renderItem`; it passes the
          // index, so resolve the item we built ourselves.
          const item = items[params.dataIndex];
          if (!item) {
            return undefined;
          }

          const lane = api.value(0) as number;
          const begin = api.value(1) as number;
          const end = api.value(2) as number;

          const start = api.coord([begin, lane]);
          const finish = api.coord([end, lane]);
          const band = (api.size?.([0, 1]) as number[] | undefined)?.[1] ?? 16;
          const height = Math.max(4, band * LANE_FILL);
          const width = Math.max(finish[0] - start[0], 1);

          // A flat edge marks a row that continues past the window boundary, so
          // a clipped overnight block doesn't read as if it simply stopped.
          const radius: [number, number, number, number] = [
            item.clippedStart ? 0 : ROUNDED[0],
            item.clippedEnd ? 0 : ROUNDED[1],
            item.clippedEnd ? 0 : ROUNDED[2],
            item.clippedStart ? 0 : ROUNDED[3],
          ];

          return {
            type: "rect",
            shape: {
              x: start[0],
              y: start[1] - height / 2,
              width,
              height,
              r: radius,
            },
            // Literal style: `api.style()` is deprecated in ECharts 6. Hover
            // feedback is the tooltip, handled inside ECharts — it never
            // re-enters React.
            style: {
              fill: colorOf(item),
              opacity: emphasized(item.app),
            },
          };
        },
      },
    ];

    // "Now" marker, only while looking at today.
    if (model.isToday) {
      const now = Date.now();
      series.push({
        type: "line",
        data: [[now, 0]],
        symbol: "none",
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: "none",
          animation: false,
          label: {
            formatter: "now",
            position: "insideEndTop",
            color: chrome.muted,
            fontSize: 10,
          },
          lineStyle: { color: chrome.muted, type: "dashed", width: 1 },
          data: [{ xAxis: now }],
        },
      });
    }

    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 4, right: 12, top: 6, bottom: 30, containLabel: true },
      yAxis: {
        type: "category",
        data: labels,
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: chrome.muted,
          fontSize: 11,
          width: 130,
          overflow: "truncate",
        },
      },
      xAxis: {
        type: "time",
        min: model.renderWindow.from,
        max: model.renderWindow.to,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: chrome.axis } },
        axisLabel: {
          color: chrome.muted,
          fontSize: 11,
          hideOverlap: true,
          formatter: (value: number) => formatClock(value).slice(0, 5),
        },
        splitLine: { lineStyle: { color: chrome.grid } },
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        {
          type: "slider",
          xAxisIndex: 0,
          filterMode: "none",
          height: 16,
          bottom: 2,
          borderColor: chrome.grid,
          fillerColor: "rgba(137,135,129,0.15)",
          handleStyle: { color: chrome.axis },
          moveHandleStyle: { color: chrome.axis },
          textStyle: { color: chrome.muted, fontSize: 10 },
          labelFormatter: (value: number) => formatClock(value).slice(0, 5),
        },
      ],
      tooltip: {
        trigger: "item",
        renderMode: "html",
        backgroundColor: chrome.surface,
        borderColor: chrome.grid,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: chrome.ink, fontSize: 12 },
        extraCssText: "border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.35)",
        formatter: (params: { data?: { raw?: TimelineItem } }) => {
          const item = params.data?.raw;
          if (!item) {
            return "";
          }
          const duration = formatDuration(item.end - item.begin);
          const title = item.idle ? "Away from keyboard" : item.title;
          return [
            `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(item.app)}</div>`,
            `<div style="max-width:320px;white-space:normal;opacity:0.75;margin-bottom:4px">${escapeHtml(title)}</div>`,
            `<div style="opacity:0.9">${formatClock(item.begin)} – ${formatClock(item.end)}</div>`,
            `<div style="font-weight:600">${duration}</div>`,
          ].join("");
        },
      },
      series,
    };
  }, [model, showIdle, selectedApp]);

  const onEvents = useMemo(
    () => ({
      click: (params: { data?: { raw?: TimelineItem } }) => {
        const app = params.data?.raw?.app;
        if (!app || app === IDLE_LABEL) {
          return;
        }
        // Clicking the selected application again clears the emphasis.
        onSelectApp(app === selectedApp ? null : app);
      },
    }),
    [onSelectApp, selectedApp],
  );

  return <EChart option={option} height="100%" onEvents={onEvents} />;
}
