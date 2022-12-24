import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { invoke } from '@tauri-apps/api'

invoke('greet', { name: 'World' })
  // `invoke` returns a Promise
  .then((response) => console.log(response))

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
