import { useEffect, useState } from 'react'
import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs';
import { Chart, GoogleDataTableColumn } from 'react-google-charts'
import Calendar from 'react-calendar'
import './App.css'

type ActivityEntry = [string, string, Date, Date]

async function readCsv(filename: string): Promise<ActivityEntry[]> {
  const content = await readTextFile(filename, { dir: BaseDirectory.Home })
  const entries = content.split('\r\n')
  let activities: ActivityEntry[] = []
  for (const entry of entries) {
    if (entry.length == 0) {
      break
    }

    const [start, end, pid, exe, title] = entry.split(', ')
    const activity: ActivityEntry = [exe, title, new Date(start), new Date(end)]
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

function App() {
  const columns: GoogleDataTableColumn[] = [
    { type: 'string', id: 'Executable' },
    { type: 'string', id: 'Title' },
    { type: 'date', id: 'Start' },
    { type: 'date', id: 'End' }
  ]

  const [rows, setRows] = useState(null as (null | ActivityEntry[]))
  const [date, setDate] = useState(new Date());

  // const filename = 'trackme/04-Dec-2022.csv'
  const filename = getLogFilename(date)
  console.log(date, ' => ', filename)
  useEffect(() => {
    const loadRows = async () => {
      const rows = await readCsv(filename)
      setRows(rows)
    }

    loadRows()
  }, [filename])

  if (rows === null) {
    return <div>Loading {filename}...</div>
  }

  const data = [columns, ...rows]
  return (
    <div className="chart">
      <Calendar onChange={setDate} value={date} />
      <Chart
        chartType="Timeline"
        data={data}
        options={{
          timeline: { colorByRowLabel: true }
        }}
        width="100%"
        height="400px"
        legendToggle
      />
    </div>
  )
}

export default App
