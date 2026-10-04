import { BarChart, CustomChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  LegendScrollComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// `esm/core`, not `lib/core`: the latter is CJS and Vite resolves it to a
// module object rather than the component ("Element type is invalid").
import ReactEChartsCore from "echarts-for-react/esm/core";
import { useEffect, useRef } from "react";

// Registered once, eagerly. Importing from `echarts/core` and listing only what
// is used keeps the bundle a fraction of the full `echarts` barrel.
echarts.use([
  CustomChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  LegendComponent,
  // The History chart can carry dozens of series, so its legend scrolls.
  LegendScrollComponent,
  CanvasRenderer,
]);

/**
 * Thin ECharts wrapper.
 *
 * Canvas (not SVG) because the timeline draws thousands of marks and SVG would
 * mean thousands of DOM nodes. The instance is created once and updated in
 * place — `notMerge={false}` — so changing data never remounts the chart.
 */
export function EChart({
  option,
  height,
  onEvents,
  replaceMerge = ["series"],
}: {
  option: EChartsCoreOption;
  height: number | string;
  /**
   * ECharts event handlers, e.g. `{ click: (params) => … }`.
   *
   * Click is deliberately the only thing routed into React state; hover is
   * handled inside ECharts so moving the mouse never re-renders the tree.
   */
  onEvents?: Record<string, (params: never) => void>;
  /**
   * Components whose arrays are replaced rather than merged.
   *
   * Series is the default because every chart here rebuilds its series from a
   * model, and the series *count* can change: filtering the history chart down
   * to one application, or leaving today and losing the timeline's "now" line.
   * With `notMerge` off — kept off so dataZoom and legend state survive an
   * update — a merge would leave the dropped series on the canvas, which looks
   * like the change never happened.
   */
  replaceMerge?: string | string[];
}) {
  const chartRef = useRef<ReactEChartsCore | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) {
      return;
    }

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // Coalesce to one resize per frame; the observer can fire in bursts.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        chartRef.current?.getEchartsInstance().resize();
      });
    });

    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} style={{ width: "100%", height }}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        notMerge={false}
        replaceMerge={replaceMerge}
        lazyUpdate
        onEvents={onEvents}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
