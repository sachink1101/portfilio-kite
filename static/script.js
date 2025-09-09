const rowsEl = document.getElementById('rows');
const totalEl = document.getElementById('totalPnl');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');

function formatMoney(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '' : '-';
  const val = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return sign + val;
}

function render(data) {
  const { positions, total_pnl } = data;
  totalEl.textContent = (total_pnl ?? 0) >= 0 ? `₹ ${formatMoney(total_pnl)}` : `-₹ ${formatMoney(total_pnl)}`;
  totalEl.classList.toggle('positive', (total_pnl ?? 0) >= 0);
  totalEl.classList.toggle('negative', (total_pnl ?? 0) < 0);

  rowsEl.innerHTML = '';
  for (const p of positions) {
    const pnl = p.pnl ?? 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.tradingsymbol ?? ''}</td>
      <td>${p.quantity ?? 0}</td>
      <td>₹ ${formatMoney(p.average_price)}</td>
      <td>₹ ${formatMoney(p.last_price)}</td>
      <td>
        <span class="pill ${pnl >= 0 ? 'pos' : 'neg'}">${pnl >= 0 ? '₹ ' : '-₹ '}${formatMoney(pnl)}</span>
      </td>
    `;
    rowsEl.appendChild(tr);
  }
}

async function fetchData() {
  try {
    statusEl.textContent = 'Loading…';
    const res = await fetch('/api/positions', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
    statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Error fetching data';
  }
}

refreshBtn.addEventListener('click', fetchData);

fetchData();
setInterval(fetchData, 10000);
