import "./style.css";

import { AccountBalance } from '@mui/icons-material'
import { CircularProgress } from '@mui/material'

import { View as AnalyticsView } from './analytics/View';
import SideMenu from './SideMenu';

function App() {
  const EmptyView = {
    name: "Empty",
    icon: <AccountBalance/>,
    component: <CircularProgress/>
  }

  const items = [
    AnalyticsView(),
    EmptyView,
  ]

  return <SideMenu items={items} />;
}

export default App;
