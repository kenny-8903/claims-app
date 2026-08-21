import { useEffect, useState } from 'react'
import './App.css'
import api from './api'

function App() {
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    api.get('/health')
      .then((res) => setMessage(res.data.status))
      .catch(() => setMessage('Backend unavailable'))
  }, [])

  return (
    <div>
      <h1>py-workflow</h1>
      <p>Backend status: {message}</p>
    </div>
  )
}

export default App