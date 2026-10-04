import { Brightness4, Brightness7, Menu as MenuIcon } from "@mui/icons-material";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { useState } from "react";
import { routes } from "../app/routes";
import { useUi } from "../app/store";

const EXPANDED_WIDTH = 224;
const COLLAPSED_WIDTH = 60;

/**
 * The navigation rail.
 *
 * Collapsed to icons by default — three destinations do not need a labelled
 * rail taking up a fifth of the window — and the labels are recovered by
 * hovering, so nothing is lost when it is closed.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const activeView = useUi((state) => state.activeView);
  const setActiveView = useUi((state) => state.setActiveView);
  const scheme = useColorScheme();
  const mode = scheme?.mode === "light" ? "light" : "dark";

  return (
    <Box
      component="nav"
      sx={{
        width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
        overflow: "hidden",
        transition: "width 150ms ease",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          minHeight: 56,
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
          flex: "0 0 auto",
        }}
      >
        <IconButton
          size="small"
          onClick={() => setOpen((value) => !value)}
          title={open ? "Collapse" : "Expand"}
        >
          <MenuIcon fontSize="small" />
        </IconButton>
        {open && (
          <Typography variant="h6" noWrap>
            Trackme
          </Typography>
        )}
      </Stack>

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 0.5 }}>
        <List dense disablePadding>
          {routes.map((route) => {
            const selected = route.id === activeView;
            const button = (
              <ListItemButton
                selected={selected}
                onClick={() => setActiveView(route.id)}
                sx={{ minHeight: 38, justifyContent: "center", px: 1.5 }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 1.5 : 0,
                    justifyContent: "center",
                    color: selected ? "primary.main" : "text.secondary",
                  }}
                >
                  {route.icon}
                </ListItemIcon>
                {open && (
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: selected ? 600 : 400, color: "text.primary" }}
                  >
                    {route.label}
                  </Typography>
                )}
              </ListItemButton>
            );

            return open ? (
              <Box key={route.id}>{button}</Box>
            ) : (
              <Tooltip key={route.id} title={route.label} placement="right">
                {button}
              </Tooltip>
            );
          })}
        </List>
      </Box>

      <Stack
        direction="row"
        sx={{
          p: 1,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: open ? "flex-start" : "center",
          flex: "0 0 auto",
        }}
      >
        <Tooltip title={mode === "dark" ? "Switch to light" : "Switch to dark"}>
          <IconButton
            size="small"
            onClick={() => scheme?.setMode(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? (
              <Brightness7 fontSize="small" />
            ) : (
              <Brightness4 fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
