import { Box } from "@mui/material";
import { routeFor } from "../app/routes";
import { useUi } from "../app/store";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const activeView = useUi((state) => state.activeView);
  const route = routeFor(activeView);
  const View = route.Component;

  return (
    <Box sx={{ display: "flex", height: "100%", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header route={route} />
        <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <View />
        </Box>
      </Box>
    </Box>
  );
}
