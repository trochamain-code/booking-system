"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

export function Chart({
  options,
  className,
}: {
  options: echarts.EChartsCoreOption;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!instance.current) {
      instance.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    }
    instance.current.setOption(options, true);
    const handleResize = () => instance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [options]);

  useEffect(() => {
    return () => {
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);

  return <div ref={ref} className={className} />;
}
