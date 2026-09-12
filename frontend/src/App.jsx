import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const sampleTelemetry = [
  { time: '00:00', temperature: 62, vibration: 0.12 },
  { time: '04:00', temperature: 65, vibration: 0.14 },
  { time: '08:00', temperature: 78, vibration: 0.28 },
  { time: '12:00', temperature: 84, vibration: 0.35 },
  { time: '16:00', temperature: 76, vibration: 0.22 },
  { time: '20:00', temperature: 68, vibration: 0.15 },
]

function Home() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              System Online
            </span>
            <h2 className="text-2xl font-bold text-white mt-2">
              Hello World 👋 Welcome to Predictive Maintenance Platform
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Phase 0 setup complete. Frontend, Tailwind CSS, React Router, and Recharts are operational.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Backend API</p>
            <p className="text-lg font-semibold text-emerald-400 mt-1">FastAPI (Uvicorn)</p>
            <p className="text-xs text-slate-400 mt-1">Port 8000 • Ready</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Frontend Client</p>
            <p className="text-lg font-semibold text-sky-400 mt-1">React + Vite</p>
            <p className="text-xs text-slate-400 mt-1">Tailwind CSS • Active</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">ML Dependencies</p>
            <p className="text-lg font-semibold text-violet-400 mt-1">Scikit-Learn & Pandas</p>
            <p className="text-xs text-slate-400 mt-1">Virtual Env • Initialized</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>Sensor Telemetry Preview (Recharts Verified)</span>
          </h3>
          <div className="h-64 w-full bg-slate-900/40 rounded-xl p-4 border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sampleTelemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="temperature" stroke="#38bdf8" strokeWidth={2} name="Temp (°C)" />
                <Line type="monotone" dataKey="vibration" stroke="#a855f7" strokeWidth={2} name="Vibration (g)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPage() {
  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-2">System Status & Architecture</h2>
      <p className="text-slate-400 text-sm mb-4">React Router routing verification page.</p>
      <div className="space-y-3 font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300">
        <p>• backend/data/ - Ready for generated CSV datasets</p>
        <p>• backend/models/ - Ready for trained model files</p>
        <p>• backend/main.py - FastAPI app running</p>
        <p>• frontend/ - React 19 + Vite + Tailwind CSS</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-cyan-500/20">
                PM
              </div>
              <span className="font-semibold text-base tracking-tight text-white">
                Predictive Maintenance Platform
              </span>
            </div>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link to="/" className="text-slate-300 hover:text-white transition">
                Overview
              </Link>
              <Link to="/status" className="text-slate-300 hover:text-white transition">
                Status
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/status" element={<StatusPage />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-400">
          Phase 0 Setup • Predictive Maintenance Platform
        </footer>
      </div>
    </BrowserRouter>
  )
}
