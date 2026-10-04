import { Insights, Settings as SettingsIcon, Timeline } from "@mui/icons-material";
import type { ComponentType, ReactNode } from "react";
import { DailyView } from "../features/daily/DailyView";
import { HistoryView } from "../features/history/HistoryView";
import { SettingsView } from "../features/settings/SettingsView";
import type { ViewId } from "./store";

/**
 * Which shared header control a route opts into.
 *
 * - `none`  — no navigation chrome
 * - `day`   — the single-day navigator (`DateNavBar`)
 * - `range` — the shared range navigator (`RangeNavBar`)
 */
export type RouteScope = "none" | "day" | "range";

export interface RouteDef {
  id: ViewId;
  label: string;
  icon: ReactNode;
  /** The header control this route gets. */
  scope: RouteScope;
  Component: ComponentType;
}

/**
 * The view registry.
 *
 * Components are stored as types rather than pre-built elements: the old
 * `View()` factories constructed every view on every render, and an array index
 * is not a stable identity. The sidebar lists the routes in order and the header
 * reads `scope`, so neither needs editing when a view is added here.
 */
export const routes: RouteDef[] = [
  {
    id: "daily",
    label: "Daily",
    icon: <Insights fontSize="small" />,
    scope: "day",
    Component: DailyView,
  },
  {
    id: "history",
    label: "History",
    icon: <Timeline fontSize="small" />,
    scope: "range",
    Component: HistoryView,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon fontSize="small" />,
    scope: "none",
    Component: SettingsView,
  },
];

export function routeFor(id: ViewId): RouteDef {
  return routes.find((route) => route.id === id) ?? routes[0]!;
}
