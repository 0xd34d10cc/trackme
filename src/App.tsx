import "./style.css";

import { View as AnalyticsView } from './analytics/View';
import { View as SettingsView } from './settings/View';
import SideMenu from './SideMenu';

function App() {
  const items = [
    AnalyticsView(),
    SettingsView(),
  ]

  return <SideMenu items={items} />;
}

export default App;
