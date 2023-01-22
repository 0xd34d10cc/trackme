import { useState } from 'react'
import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs'

import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectChangeEvent } from '@mui/material/Select'

import PieChart from './PieChart';
import Timeline from './Timeline';
import DatePicker from './DatePicker'

async function readActivitySet(): Promise<Set<string>> {
  const content = await readTextFile('trackme/activities.json', { dir: BaseDirectory.Home })
  const list = JSON.parse(content) as [string]
  const set = new Set<string>()
  for (const activity of list) {
    set.add(activity)
  }

  return set
}

// TODO: move to useEffect()
const activities = await readActivitySet()

function App() {
  const [date, setDate] = useState(new Date());
  const [type, setType] = useState('Timeline')

  let chart = null
  if (type == 'Timeline') {
    chart = <Timeline date={date}/>
  } else if (type == 'PieChart') {
    chart = <PieChart date={date}/>
  }

  const updateType = (e: SelectChangeEvent) => {
    setType(e.target.value)
  }

  return (
    <div className="chart">
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Type</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={type}
          label="Type"
          onChange={updateType}
        >
          <MenuItem value={'Timeline'}>Timeline</MenuItem>
          <MenuItem value={'PieChart'}>Pie</MenuItem>
        </Select>
      </FormControl>
      <DatePicker date={date} setDate={setDate}/>
      {chart}
    </div>
  )
}

export default App
