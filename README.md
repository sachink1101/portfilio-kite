# Portfolio Positions UI (Flask + React/Vite)

This app shows live Zerodha Kite positions and total P&L.

Backend: Python Flask wraps your existing Kite logic and exposes `GET /api/positions`.
Frontend: React + TypeScript (Vite) + Tailwind mobile-first UI.

## Environment Variables
Set on Render (or locally in your shell):
- `CLIENT_ID`
- `PASSWORD`
- `AUTH_SECRET`
- `API_KEY`
- `API_SECRET`

Locally you can also use `credentials.json` with the same keys.

## Local Development
1. Backend
```
python -m pip install -r requirements.txt
python portfilio.py
```
Backend runs on http://localhost:8000

2. Frontend
```
cd frontend
npm install
npm run dev
```
Vite dev server runs on http://localhost:5173 and proxies `/api` to backend.

## Build & Serve Frontend via Flask
```
cd frontend
npm run build
```
This outputs to `../static/`. Flask serves `/` from `static/index.html`.

## Deploy to Render
- New Web Service from this repo root
- Runtime: Python
- Build Command:
```
pip install -r requirements.txt && cd frontend && npm ci && npm run build
```
- Start Command:
```
 gunicorn portfilio:app --timeout 120 --workers 2 --bind 0.0.0.0:$PORT
```
- Add environment variables listed above.

## API
```
GET /api/positions
{
  "positions": [{
    "tradingsymbol": "RELIANCE",
    "quantity": 10,
    "pnl": 1500.5,
    "average_price": 2450.0,
    "last_price": 2600.5
  }],
  "total_pnl": 1234.56
}
```

Frontend computes percentage: `(last_price - average_price) / average_price * 100`.
