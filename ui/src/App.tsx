import { useEffect, useState } from 'react'
import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs'
import { Chart, GoogleDataTableColumn, GoogleChartWrapperChartType, GoogleDataTableColumnRoleType } from 'react-google-charts'

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { formatDuration, differenceInSeconds, intervalToDuration } from 'date-fns';

type ActivityEntry = [string, string, Date, Date]

function getFilename(path: string): string {
  const win = path.split('\\').pop()
  if (win === undefined) {
    return ''
  }
  const unix = win.split('/').pop()
  if (unix === undefined) {
    return ''
  }
  return unix
}

async function readCsv(filename: string): Promise<ActivityEntry[]> {
  const content = await readTextFile(filename, { dir: BaseDirectory.Home })
  const entries = content.split('\n')
  let activities: ActivityEntry[] = []
  for (const entry of entries) {
    if (entry.length == 0) {
      break
    }

    const [start, end, pid, exe, title] = entry.split(',')
    const activity: ActivityEntry = [
      getFilename(exe.trim()),
      title.trim(),
      new Date(start.trim()),
      new Date(end.trim())
  ]
    activities.push(activity)
  }

  return Promise.resolve(activities)
}

const Months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

function getLogFilename(date: Date): string {
  const day = ('0' + date.getDate()).slice(-2)
  const month = Months[date.getMonth()]
  const year = date.getFullYear()
  return `trackme/${day}-${month}-${year}.csv`
}

function aggregateTime(rows: ActivityEntry[]): IterableIterator<[string, number]> {
  let map: Map<string, number> = new Map()
  for (const [exe, _title, start, end] of rows) {
    const duration = differenceInSeconds(end, start)
    const current = map.get(exe)
    if (current === undefined) {
      map.set(exe, duration)
    } else {
      map.set(exe, current + duration)
    }
  }

  return map.entries()
}

const TimelineColumns: GoogleDataTableColumn[] = [
  { type: 'string', id: 'Executable' },
  { type: 'string', id: 'Title' },
  { type: 'date', id: 'Start' },
  { type: 'date', id: 'End' }
]

const PieChartColumns: GoogleDataTableColumn[] = [
  { type: 'string', id: 'Executable' },
  { type: 'number', id: 'Length' },
  { type: 'string', role: GoogleDataTableColumnRoleType.tooltip }
]

function getChartData(rows: ActivityEntry[], chartType: string): any[] {
  if (chartType == 'Timeline') {
    return [TimelineColumns, ...rows]
  }

  if (chartType == 'PieChart') {
    const pieRows = []
    for (const [name, seconds] of aggregateTime(rows)) {
      const duration = intervalToDuration({ start: 0, end: seconds * 1000 })
      const tooltip = name + ' - ' + formatDuration(duration)
      pieRows.push([name, seconds, tooltip])
    }
    return [PieChartColumns, ...pieRows]
  }

  throw new Error('Unknown chart type: ' + chartType)
}

function App() {
  const [type, setType] = useState('Timeline' as GoogleChartWrapperChartType)
  const [rows, setRows] = useState(null as (null | ActivityEntry[]))
  const [date, setDate] = useState(new Date());

  const filename = getLogFilename(date)
  console.log(date, ' => ', filename)
  useEffect(() => {
    const loadRows = async () => {
      const rows = await readCsv(filename)
      setRows(rows)
    }

    setRows(null)
    loadRows()
  }, [filename])

  const datePicker =
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        value={date}
        onChange={(date: Date | null, _selectionState?: any) => {
          if (date != null) {
            setDate(date);
          }
        }}
        renderInput={(params: any) => <TextField {...params} />}
      />
    </LocalizationProvider>

  let chart = null
  if (rows === null) {
    chart = <>
      <div>Loading {filename}...</div>
      <CircularProgress />
    </>
  } else {
    const data = getChartData(rows, type)
    chart = <Chart
      chartType={type}
      data={data}
      options={{
        timeline: { colorByRowLabel: true },
        pieHole: 0.4
      }}
      width="100%"
      height="600px"
      legendToggle
    />
  }

  const updateType = (e: SelectChangeEvent) => {
    setType(e.target.value as GoogleChartWrapperChartType)
  }

  return (
    <div className="chart">
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Chart type</InputLabel>
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
      {datePicker}
      {chart}
    </div>
  )
}

export default App
