import { useEffect, useState } from "react";
import { Settings } from "@mui/icons-material";
import { invoke } from "@tauri-apps/api";
import { CircularProgress } from "@mui/material";

// {
//   blacklist: ["browser_private"],
//   matchers: [
//     { matcher: "title contains 'Private Browsing'", name: "browser_private" },
//   ],
//   storage: { location: null },
// ;
type Config = {
  blacklist: string[];
  matchers: Matcher[];
  storage: { location: string | null };
};

type Matcher = {
  name: string;
  matcher: string;
};

function Component() {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    const loadConfig = async () => {
      const config = (await invoke("get_config")) as Config;
      setConfig(config);
    };

    loadConfig();
    // TODO: reload once we click 'apply' or 'cancel' button
  }, [null]);

  if (!config) {
    return <CircularProgress />;
  }

  // TODO: render settings editor
  return <>{JSON.stringify(config)}</>;
}

export function View() {
  return {
    name: "Settings",
    icon: <Settings />,
    component: Component(),
  };
}
