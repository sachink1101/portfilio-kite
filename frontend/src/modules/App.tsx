import React, { useEffect, useMemo, useRef, useState } from 'react'

type Position = {
  tradingsymbol: string
  quantity: number
  pnl: number
  average_price: number
  last_price: number
}

type ApiResponse = {
  positions: Position[]
  total_pnl: number
  error?: string
}

const fmtMoney = (n: number | undefined | null) => {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '-' : ''}₹ ${s}`
}

const pct = (avg: number, last: number) => {
  if (!avg) return 0
  return ((last - avg) / avg) * 100
}

const usePolling = (cb: () => void, ms: number) => {
  const saved = useRef(cb)
  useEffect(() => { saved.current = cb }, [cb])
  useEffect(() => {
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

const Header: React.FC<{ syncing: boolean; last: Date | null; onSync: () => void }> = ({ syncing, last, onSync }) => {
  return (
    <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10">
      <div className="px-4 py-3 flex items-center justify-between">
        <button className="w-10 h-10 flex items-center justify-center rounded-md active:scale-95" aria-label="Back">
          <span className="i-ph-list text-slate-300">≡</span>
        </button>
        <div className="font-semibold">Positions</div>
        <button onClick={onSync} className="w-10 h-10 flex items-center justify-center rounded-md active:scale-95" aria-label="Sync">
          <svg className={`w-5 h-5 text-slate-200 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 3v6h-6"/></svg>
        </button>
      </div>
      <div className="px-4 pb-2 text-xs text-slate-400">{last ? `Updated ${last.toLocaleTimeString()}` : '—'}</div>
    </div>
  )
}

const TotalCard: React.FC<{ total: number; showPct: boolean; onToggle: () => void }> = ({ total, showPct, onToggle }) => {
  const positive = (total ?? 0) >= 0
  return (
    <div className="mx-4 mt-3 rounded-xl border border-white/10 bg-slate-800/50 shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400 mb-1">Unrealised P&L</div>
          <div className={`text-2xl font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>{fmtMoney(total)}</div>
        </div>
        <button onClick={onToggle} className="text-xs px-3 py-1 rounded-md border border-white/10 bg-slate-900/60">
          {showPct ? 'Show ₹' : 'Show %'}
        </button>
      </div>
    </div>
  )
}

const LoadingSkeleton: React.FC = () => (
  <div className="mt-3 space-y-2 px-4">
    {[0,1,2].map(i => (
      <div key={i} className="h-20 rounded-xl bg-slate-700/40 animate-pulse" />
    ))}
  </div>
)

const ErrorToast: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="fixed bottom-4 inset-x-0 px-4">
    <div className="mx-auto max-w-sm rounded-lg border border-red-500/30 bg-red-900/10 text-red-300 px-4 py-3 shadow-lg flex items-center justify-between gap-3">
      <span className="text-sm">{message}</span>
      <button onClick={onRetry} className="text-sm font-semibold underline">Retry</button>
    </div>
  </div>
)

const PositionCard: React.FC<{ p: Position; showPct: boolean; onClick: () => void }> = ({ p, showPct, onClick }) => {
  const pnlPct = useMemo(() => pct(p.average_price, p.last_price), [p.average_price, p.last_price])
  const profit = (p.pnl ?? 0) >= 0
  return (
    <button onClick={onClick} className="w-full text-left">
      <div className="mx-4 mt-2 rounded-xl border border-white/10 bg-slate-800/50 shadow-lg px-4 py-3 active:scale-[0.99] transition-transform">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-base">{p.tradingsymbol}</div>
            <div className="text-xs text-slate-400">Qty • {p.quantity}</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${profit ? 'text-green-400' : 'text-red-400'}`}>{fmtMoney(p.pnl)}</div>
            <div className={`text-xs ${profit ? 'text-green-400/80' : 'text-red-400/80'}`}>{pnlPct.toFixed(2)}%</div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div><span className="text-slate-400">Avg</span> ₹ {p.average_price?.toFixed(2)}</div>
          <div><span className="text-slate-400">LTP</span> ₹ {p.last_price?.toFixed(2)}</div>
          <div>
            <span className={`px-2 py-0.5 rounded-full ${profit ? 'bg-green-900/10 text-green-400' : 'bg-red-900/10 text-red-400'}`}>
              {profit ? 'Profit' : 'Loss'}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

const BottomSheetDetails: React.FC<{ p: Position | null; onClose: () => void }> = ({ p, onClose }) => {
  if (!p) return null
  const pnlPct = pct(p.average_price, p.last_price)
  const profit = (p.pnl ?? 0) >= 0
  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 border-t border-white/10 p-4 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20 mb-3" />
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg">{p.tradingsymbol}</div>
          <button onClick={onClose} className="text-slate-300">Close</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-slate-800/50 p-3">
            <div className="text-xs text-slate-400">Unrealised P&L</div>
            <div className={`text-xl font-bold ${profit ? 'text-green-400' : 'text-red-400'}`}>{fmtMoney(p.pnl)}</div>
            <div className={`text-xs ${profit ? 'text-green-400/80' : 'text-red-400/80'}`}>{pnlPct.toFixed(2)}%</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-800/50 p-3 text-sm">
            <div><span className="text-slate-400">Qty:</span> {p.quantity}</div>
            <div><span className="text-slate-400">Avg:</span> ₹ {p.average_price?.toFixed(2)}</div>
            <div><span className="text-slate-400">LTP:</span> ₹ {p.last_price?.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className="px-3 py-2 rounded-md border border-white/10 bg-slate-800 text-slate-400" title="Not available">Place Order</button>
          <span className="text-xs text-slate-400">Not available</span>
        </div>
      </div>
    </div>
  )
}

const App: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<Date | null>(null)
  const [showPct, setShowPct] = useState(false)
  const [selected, setSelected] = useState<Position | null>(null)
  const [intervalMs, setIntervalMs] = useState(10000)

  useEffect(() => {
    const cached = localStorage.getItem('positions-cache')
    if (cached) {
      try { setData(JSON.parse(cached)); setLoading(false) } catch {}
    }
  }, [])

  const fetchData = async () => {
    try {
      setError(null)
      const res = await fetch('/api/positions', { cache: 'no-store' })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as ApiResponse
      if ((json as any).error === 'authentication_failed') throw new Error('authentication_failed')
      setData(json)
      localStorage.setItem('positions-cache', JSON.stringify(json))
      setLast(new Date())
      setLoading(false)
    } catch (e: any) {
      if (e?.message?.includes('authentication_failed')) {
        setError('Authentication failed. Tap to retry.')
      } else {
        setError('Network error. Retry')
      }
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])
  usePolling(fetchData, intervalMs)

  const positions = data?.positions ?? []

  return (
    <div className="min-h-svh">
      <Header syncing={loading} last={last} onSync={fetchData} />

      <TotalCard total={data?.total_pnl ?? 0} showPct={showPct} onToggle={() => setShowPct(v => !v)} />

      <div className="mt-1">
        {loading && !positions.length ? <LoadingSkeleton /> : null}
        {!loading && positions.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400">
            <div className="text-6xl mb-3">📭</div>
            <div className="mb-2">No open positions</div>
            <button onClick={fetchData} className="px-3 py-2 rounded-md border border-white/10 bg-slate-800">Refresh</button>
          </div>
        ) : null}
        <div className="pb-24">
          {positions.map((p) => (
            <PositionCard key={p.tradingsymbol} p={p} showPct={showPct} onClick={() => setSelected(p)} />
          ))}
        </div>
      </div>

      {error ? <ErrorToast message={error} onRetry={fetchData} /> : null}
      <BottomSheetDetails p={selected} onClose={() => setSelected(null)} />

      <div className="fixed bottom-4 right-4">
        <div className="rounded-lg bg-slate-800/60 border border-white/10 shadow-lg px-3 py-2 text-xs flex items-center gap-2">
          <span>Auto-refresh</span>
          <select value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))} className="bg-transparent outline-none">
            <option className="bg-slate-900" value={5000}>5s</option>
            <option className="bg-slate-900" value={10000}>10s</option>
            <option className="bg-slate-900" value={15000}>15s</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default App
