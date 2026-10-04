import { Insights, Settings as SettingsIcon } from "@mui/icons-material";
import type { ComponentType, ReactNode } from "react";
import { DailyView } from "../features/daily/DailyView";
import { SettingsView } from "../features/settings/SettingsView";
import type { ViewId } from "./store";

export interface RouteDef {
  id: ViewId;
  label: string;
  icon: ReactNode;
  /** Sidebar section. Future use cases slot into these without shell changes. */
  group: string;
  /** Whether the header shows the shared date navigator. */
  dateScoped: boolean;
  Component: ComponentType;
}

/**
 * The view registry.
 *
 * Components are stored as types rather than pre-built elements: the old
 * `View()` factories constructed every view on every render, and an array index
 * is not a stable identity. `dateScoped` is the hook the ~20 remaining use
 * cases will use to opt into the date bar.
 */
export const routes: RouteDef[] = [
  {
    id: "daily",
    label: "Daily",
    icon: <Insights fontSize="small" />,
    group: "Activity",
    dateScoped: true,
    Component: DailyView,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon fontSize="small" />,
    group: "System",
    dateScoped: false,
    Component: SettingsView,
  },
];

export function routeFor(id: ViewId): RouteDef {
  return routes.find((route) => route.id === id) ?? routes[0]!;
}
