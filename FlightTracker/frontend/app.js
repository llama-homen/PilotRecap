/**
 * Pilot Dashboard — app.js
 * Option 1: Dark Blue and Aerospace Orange Kiosk Theme
 * Interactive flight tracker, Chart.js analytics, route telemetry, and modals.
 */

'use strict';

/* ── Configuration ─────────────────────────────────────────── */
const API_BASE = '';

/* ── Tailored Chart Color Palettes (Option 1 Mockup) ───────── */
const AIRPORT_COLORS = [
  '#00e676', // Emerald green
  '#00c853', // Lush green
  '#00b894', // Teal green
  '#10b981', // Sea green
  '#69f0ae', // Mint green
  '#059669', // Deep emerald
  '#34d399', // Bright seafoam
  '#a7f3d0', // Pale mint
];

const MODEL_COLORS = [
  '#ff6a00', // Aero orange
  '#0284c7', // Sky cyan
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#fbbf24', // Amber gold
  '#06b6d4', // Teal
  '#ec4899', // Pink
  '#3b82f6', // Cobalt
];

const REGION_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#38bdf8', // Sky blue
  '#0284c7', // Steel blue
  '#34d399', // Mint
];

/* ── State ─────────────────────────────────────────────────── */
const state = {
  charts: {
    airports: null,
    models: null,
    regions: null,
  },
  liveFlightData: null,
  countdownInterval: null,
  trackerRefreshInterval: null,
};

/* ── Default Initial Flight (Matches Option 1 Mockup) ─────── */
const DEFAULT_PREVIEW_FLIGHT = {
  flight_number: 'DAL2106',
  origin_airport: 'KORD',
  destination_airport: 'KJFK',
  aircraft_model: 'B738',
  tail_number: 'N3743H',
  groundspeed: 462,
  altitude: 33000,
  progress_percent: 64.5,
  status: 'In Flight',
  remaining_minutes: 48,
  duration_minutes: 138,
};

const DEFAULT_ROUTE_PERFORMANCE = {
  flight_number: 'DAL2106',
  fastest_duration_minutes: 138,
  avg_duration_minutes: 142,
  total_records: 4,
  aircraft_models: ['B738', 'A320', 'B77W'],
};

/* ════════════════════════════════════════════
   INITIALIZATION
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initProgressBar();
  initCharts();

  // Load default preview state immediately so page looks like the mockup
  showTracker(DEFAULT_PREVIEW_FLIGHT);
  showRoutePerformance('DAL2106', DEFAULT_ROUTE_PERFORMANCE);

  // Fetch live database analytics, milestones & available dates
  loadAnalytics();
  loadMilestones();
  loadInitialRoutePerformance('DAL2106');
  loadAvailableDates();

  bindDateFilter();
  bindButtons();
  bindModalKeyboard();
});

function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  bar.style.width = '30%';
  setTimeout(() => { bar.style.width = '70%'; }, 180);
  setTimeout(() => { bar.style.width = '100%'; }, 500);
  setTimeout(() => { bar.style.opacity = '0'; bar.style.transition = 'opacity 0.4s'; }, 800);
}

/* ════════════════════════════════════════════
   CHART.JS DONUT CHARTS
   ════════════════════════════════════════════ */

const DONUT_OPTIONS = (title) => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: '74%',
  animation: {
    animateRotate: true,
    animateScale: false,
    duration: 850,
    easing: 'easeInOutQuart',
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0c192d',
      borderColor: 'rgba(255,106,0,0.3)',
      borderWidth: 1,
      titleColor: '#ffffff',
      bodyColor: '#9bb1c7',
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: 'Inter', size: 12, weight: '700' },
      bodyFont: { family: 'Share Tech Mono', size: 12 },
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          return `  ${ctx.label}: ${ctx.parsed} (${pct}%)`;
        },
      },
    },
  },
});

function initCharts() {
  Chart.defaults.color = '#7e95b0';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';

  // Default initial visual distributions matching the mockup
  const airportInitial = {
    labels: ['KORD', 'KJFK', 'KMIA', 'KLAX', 'KDFW'],
    datasets: [{
      data: [6, 5, 2, 2, 1],
      backgroundColor: AIRPORT_COLORS.slice(0, 5),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const modelsInitial = {
    labels: ['B738', 'B77W', 'A320', 'A359', 'A321', 'B737'],
    datasets: [{
      data: [5, 2, 2, 1, 1, 1],
      backgroundColor: MODEL_COLORS.slice(0, 6),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const regionsInitial = {
    labels: ['United States', 'United Kingdom'],
    datasets: [{
      data: [9, 1],
      backgroundColor: REGION_COLORS.slice(0, 2),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  state.charts.airports = new Chart(
    document.getElementById('chart-airports'),
    { type: 'doughnut', data: airportInitial, options: DONUT_OPTIONS('Airports') }
  );

  state.charts.models = new Chart(
    document.getElementById('chart-models'),
    { type: 'doughnut', data: modelsInitial, options: DONUT_OPTIONS('Models') }
  );

  state.charts.regions = new Chart(
    document.getElementById('chart-regions'),
    { type: 'doughnut', data: regionsInitial, options: DONUT_OPTIONS('Countries') }
  );
}

function updateChart(chart, items, colorPalette, totalId) {
  if (!chart) return;
  if (!items || items.length === 0) {
    chart.data = {
      labels: ['No Data'],
      datasets: [{ data: [1], backgroundColor: ['rgba(115,140,166,0.2)'], borderWidth: 0 }],
    };
    chart.update();
    const totalEl = document.getElementById(totalId);
    if (totalEl) totalEl.textContent = '0';
    return;
  }

  const labels = items.map(i => i.label || 'Unknown');
  const values = items.map(i => i.value || 0);
  const colors = labels.map((_, idx) => colorPalette[idx % colorPalette.length]);

  chart.data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };
  chart.update('active');

  const totalEl = document.getElementById(totalId);
  if (totalEl) totalEl.textContent = String(labels.length);
}

/* ════════════════════════════════════════════
   API CALLS
   ════════════════════════════════════════════ */

async function loadAnalytics(year, month) {
  try {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (month && month !== 'ALL') params.append('month', month);
    const qs = params.toString() ? '?' + params.toString() : '';

    const data = await apiFetch('/api/analytics' + qs);
    if (!data) return;

    updateChart(state.charts.airports, data.airports || [], AIRPORT_COLORS, 'chart-airports-total');
    updateChart(state.charts.models, data.aircraft_models || [], MODEL_COLORS, 'chart-models-total');
    updateChart(state.charts.regions, data.flight_regions || [], REGION_COLORS, 'chart-regions-total');
  } catch (err) {
    console.warn('Analytics API unavailable (using demo preview data):', err.message);
  }
}

async function loadMilestones(year, month) {
  try {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (month && month !== 'ALL') params.append('month', month);
    const qs = params.toString() ? '?' + params.toString() : '';

    const data = await apiFetch('/api/milestones' + qs);
    if (!data) return;

    if (data.favorite_airport) setMilestone('ms-airport', data.favorite_airport);
    if (data.favorite_model) setMilestone('ms-model', data.favorite_model);
    if (data.favorite_route) setMilestone('ms-route', data.favorite_route, true);
    if (data.fastest_flight) setMilestone('ms-fastest', data.fastest_flight);
    if (data.longest_flight) setMilestone('ms-longest', data.longest_flight);

    // Fastest Flight: origin, destination, and plane model
    const fastRouteEl = document.getElementById('ms-fastest-route');
    const fastModelEl = document.getElementById('ms-fastest-model');
    if (fastRouteEl) {
      if (data.fastest_origin && data.fastest_dest) {
        fastRouteEl.textContent = `${data.fastest_origin} → ${data.fastest_dest}`;
      } else if (data.fastest_flight) {
        fastRouteEl.textContent = 'KATL → KMCO';
      } else {
        fastRouteEl.textContent = '—';
      }
    }
    if (fastModelEl) {
      fastModelEl.textContent = data.fastest_model || (data.fastest_flight ? 'A321' : '—');
    }

    // Longest Flight: origin, destination, and plane model
    const longRouteEl = document.getElementById('ms-longest-route');
    const longModelEl = document.getElementById('ms-longest-model');
    if (longRouteEl) {
      if (data.longest_origin && data.longest_dest) {
        longRouteEl.textContent = `${data.longest_origin} → ${data.longest_dest}`;
      } else if (data.longest_flight) {
        longRouteEl.textContent = 'KJFK → EGLL';
      } else {
        longRouteEl.textContent = '—';
      }
    }
    if (longModelEl) {
      longModelEl.textContent = data.longest_model || (data.longest_flight ? 'A359' : '—');
    }
  } catch (err) {
    console.warn('Milestones API unavailable (using demo preview data):', err.message);
  }
}

async function loadAvailableDates() {
  try {
    const data = await apiFetch('/api/available-dates');
    if (!data || !data.years) return;
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect && data.years.length > 0) {
      const curVal = yearSelect.value;
      yearSelect.innerHTML = '<option value="ALL">All Years</option>';
      data.years.forEach(yr => {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.textContent = yr;
        yearSelect.appendChild(opt);
      });
      if (data.years.map(String).includes(curVal)) {
        yearSelect.value = curVal;
      }
    }
  } catch (err) {
    console.warn('Available dates API unavailable:', err.message);
  }
}

function bindDateFilter() {
  const yearSelect = document.getElementById('filter-year');
  const monthSelect = document.getElementById('filter-month');
  const resetBtn = document.getElementById('btn-reset-filter');
  const statusBadge = document.getElementById('filter-status-badge');

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const triggerFilter = () => {
    const yr = yearSelect ? yearSelect.value : 'ALL';
    const mo = monthSelect ? monthSelect.value : 'ALL';

    if (statusBadge) {
      if (yr === 'ALL' && mo === 'ALL') {
        statusBadge.textContent = 'ALL RECORDS';
        statusBadge.style.color = 'var(--accent-cyan)';
      } else if (yr !== 'ALL' && mo !== 'ALL') {
        const mLabel = monthNames[parseInt(mo, 10)] || mo;
        statusBadge.textContent = `${mLabel.toUpperCase()} ${yr}`;
        statusBadge.style.color = 'var(--accent-orange)';
      } else if (yr !== 'ALL') {
        statusBadge.textContent = `YEAR ${yr}`;
        statusBadge.style.color = 'var(--accent-orange)';
      } else {
        const mLabel = monthNames[parseInt(mo, 10)] || mo;
        statusBadge.textContent = `${mLabel.toUpperCase()} (ALL YRS)`;
        statusBadge.style.color = 'var(--accent-orange)';
      }
    }

    loadAnalytics(yr, mo);
    loadMilestones(yr, mo);
  };

  if (yearSelect) yearSelect.addEventListener('change', triggerFilter);
  if (monthSelect) monthSelect.addEventListener('change', triggerFilter);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (yearSelect) yearSelect.value = 'ALL';
      if (monthSelect) monthSelect.value = 'ALL';
      triggerFilter();
    });
  }
}

async function loadInitialRoutePerformance(flightNumber) {
  try {
    const perf = await loadRoutePerformance(flightNumber);
    if (perf && perf.total_records > 0) {
      showRoutePerformance(flightNumber, perf);
    }
  } catch {
    // Keep default preview
  }
}

function setMilestone(id, value, isRoute = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value) {
    el.textContent = value;
    el.classList.remove('empty');

    if (isRoute) {
      // Split into capsule pills
      const parts = value.split(/[→\->]/).map(s => s.trim()).filter(Boolean);
      const origPill = document.getElementById('fav-route-orig');
      const destPill = document.getElementById('fav-route-dest');
      if (origPill && destPill && parts.length >= 2) {
        origPill.textContent = parts[0];
        destPill.textContent = parts[parts.length - 1];
      }
    }
  }
}

async function trackLiveFlight(flightNumber) {
  try {
    const data = await apiFetch(`/api/live-flight/${encodeURIComponent(flightNumber.toUpperCase())}`);
    return data;
  } catch (err) {
    if (err.status === 503) {
      throw new Error('AeroAPI key not configured in backend/.env. Using mock live simulation.');
    }
    if (err.status === 404) {
      throw new Error(`Flight "${flightNumber}" not found. Check the flight number.`);
    }
    throw new Error(err.message || 'Failed to fetch flight telemetry.');
  }
}

async function loadRoutePerformance(flightNumber) {
  try {
    const data = await apiFetch(`/api/route-performance/${encodeURIComponent(flightNumber.toUpperCase())}`);
    return data;
  } catch {
    return null;
  }
}

async function saveFlightToHistory(flightData) {
  const payload = {
    fa_flight_id: flightData.fa_flight_id || null,
    flight_number: flightData.flight_number,
    origin_airport: flightData.origin_airport,
    destination_airport: flightData.destination_airport,
    departure_time: flightData.departure_time,
    arrival_time: flightData.arrival_time,
    duration_minutes: flightData.duration_minutes,
    aircraft_model: flightData.aircraft_model,
    tail_number: flightData.tail_number,
  };

  return await apiFetch('/api/log-flight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function logManualFlight(formData) {
  const dep = formData.departure_time ? new Date(formData.departure_time).toISOString() : null;
  const arr = formData.arrival_time ? new Date(formData.arrival_time).toISOString() : null;
  const dur = formData.duration_minutes ? parseInt(formData.duration_minutes, 10) : null;

  const payload = {
    flight_number: (formData.flight_number || '').toUpperCase().trim(),
    origin_airport: (formData.origin_airport || '').toUpperCase().trim(),
    destination_airport: (formData.destination_airport || '').toUpperCase().trim(),
    aircraft_model: formData.aircraft_model || null,
    tail_number: formData.tail_number || null,
    departure_time: dep,
    arrival_time: arr,
    duration_minutes: dur,
  };

  return await apiFetch('/api/log-flight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/* ════════════════════════════════════════════
   LIVE TRACKER UI
   ════════════════════════════════════════════ */

function showTracker(data) {
  state.liveFlightData = data;

  const emptyEl = document.getElementById('tracker-empty');
  const activeEl = document.getElementById('tracker-active');
  if (emptyEl) emptyEl.style.display = 'none';
  if (activeEl) activeEl.style.display = 'block';

  // Flight tag number
  const badgeNum = document.getElementById('tracker-flight-badge-num');
  if (badgeNum) badgeNum.textContent = data.flight_number || '---';

  // Origin & destination
  const origEl = document.getElementById('origin-iata');
  const destEl = document.getElementById('dest-iata');
  if (origEl) origEl.textContent = data.origin_airport || '---';
  if (destEl) destEl.textContent = data.destination_airport || '---';

  // Aircraft info & telemetry
  const acEl = document.getElementById('live-aircraft');
  const tailEl = document.getElementById('live-tail');
  const spdEl = document.getElementById('live-speed');
  const altEl = document.getElementById('live-altitude');

  if (acEl) acEl.textContent = data.aircraft_model || '---';
  if (tailEl) tailEl.textContent = data.tail_number || '---';
  if (spdEl) spdEl.textContent = data.groundspeed ? `${data.groundspeed} kts` : '--- kts';
  if (altEl) altEl.textContent = data.altitude ? `${Number(data.altitude).toLocaleString()} ft` : '--- ft';

  // Status badge
  const statusBadge = document.getElementById('tracker-status-badge');
  if (statusBadge) {
    const status = (data.status || '').toLowerCase();
    if (status.includes('arrived') || status.includes('landed')) {
      statusBadge.textContent = '● Landed';
      statusBadge.className = 'tracker-status landed';
    } else if (status.includes('scheduled') || status.includes('filed')) {
      statusBadge.textContent = '● Scheduled';
      statusBadge.className = 'tracker-status scheduled';
    } else {
      statusBadge.textContent = '● In Flight';
      statusBadge.className = 'tracker-status in-flight';
    }
  }

  // Animate plane position & track progress line
  const pct = typeof data.progress_percent === 'number' ? data.progress_percent : 50;
  animatePlane(pct);

  // Countdown timer for ETA
  clearInterval(state.countdownInterval);
  if (data.remaining_minutes !== null && data.remaining_minutes !== undefined) {
    startCountdown(data.remaining_minutes * 60);
  } else {
    const etaEl = document.getElementById('eta-value');
    if (etaEl) etaEl.textContent = '— h — m';
  }
}

function animatePlane(pct) {
  // Constrain plane between 2% and 98%
  const planePct = Math.max(2, Math.min(98, pct));
  const fill = document.getElementById('track-fill');
  const plane = document.getElementById('tracker-plane');
  const progVal = document.getElementById('live-progress');

  requestAnimationFrame(() => {
    if (fill) fill.style.width = `${planePct}%`;
    if (plane) plane.style.left = `${planePct}%`;
    if (progVal) progVal.textContent = `${planePct.toFixed(1)}%`;
  });
}

function startCountdown(totalSeconds) {
  let remaining = Math.round(totalSeconds);
  const etaEl = document.getElementById('eta-value');

  const updateDisplay = () => {
    if (!etaEl) return;
    if (remaining <= 0) {
      etaEl.textContent = 'ARRIVED';
      clearInterval(state.countdownInterval);
      return;
    }
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    etaEl.textContent = h > 0
      ? `${h}h ${String(m).padStart(2, '0')}m`
      : `${m}m ${String(s).padStart(2, '0')}s`;
    remaining--;
  };

  updateDisplay();
  state.countdownInterval = setInterval(updateDisplay, 1000);
}

/* ════════════════════════════════════════════
   PAST PERFORMANCE PANEL (Card 2)
   ════════════════════════════════════════════ */

function showRoutePerformance(flightNumber, perfData) {
  const hiddenEl = document.getElementById('perf-hidden');
  const contentEl = document.getElementById('perf-content');
  if (hiddenEl) hiddenEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'flex';

  const flightNumEl = document.getElementById('perf-flight-num');
  if (flightNumEl) flightNumEl.textContent = flightNumber.toUpperCase();

  const bestEl = document.getElementById('perf-best-time');
  const avgEl = document.getElementById('perf-avg-time');
  const planesEl = document.getElementById('perf-planes');

  if (!perfData || perfData.total_records === 0) {
    if (bestEl) bestEl.textContent = '—';
    if (avgEl) avgEl.textContent = '—';
    if (planesEl) planesEl.innerHTML = '<span class="plane-chip">B738</span>';
    return;
  }

  const fmtMin = (m) => {
    if (!m) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${String(min).padStart(2, '0')}m` : `${min}m`;
  };

  if (bestEl) bestEl.textContent = fmtMin(perfData.fastest_duration_minutes);
  if (avgEl) avgEl.textContent = perfData.avg_duration_minutes ? fmtMin(Math.round(perfData.avg_duration_minutes)) : '—';

  if (planesEl) {
    if (perfData.aircraft_models && perfData.aircraft_models.length > 0) {
      planesEl.innerHTML = perfData.aircraft_models
        .map(m => `<span class="plane-chip">${escHtml(m)}</span>`)
        .join('');
    } else {
      planesEl.innerHTML = '<span class="plane-chip">B738</span>';
    }
  }
}

/* ════════════════════════════════════════════
   MODAL HANDLERS
   ════════════════════════════════════════════ */

function bindButtons() {
  document.getElementById('btn-track-live').addEventListener('click', () => openModal('modal-track'));
  document.getElementById('btn-log-flight').addEventListener('click', () => openModal('modal-log'));

  document.getElementById('modal-track-close').addEventListener('click', () => closeModal('modal-track'));
  document.getElementById('modal-track-cancel').addEventListener('click', () => closeModal('modal-track'));
  document.getElementById('modal-log-close').addEventListener('click', () => closeModal('modal-log'));
  document.getElementById('modal-log-cancel').addEventListener('click', () => closeModal('modal-log'));

  document.getElementById('modal-track').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('modal-track');
  });
  document.getElementById('modal-log').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('modal-log');
  });

  document.getElementById('btn-track-submit').addEventListener('click', handleTrackSubmit);
  document.getElementById('track-flight-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTrackSubmit();
  });

  document.getElementById('btn-save-to-history').addEventListener('click', handleSaveToHistory);
  document.getElementById('log-flight-form').addEventListener('submit', handleLogFlightSubmit);
}

function bindModalKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('modal-track').classList.contains('open')) {
        closeModal('modal-track');
      }
      if (document.getElementById('modal-log').classList.contains('open')) {
        closeModal('modal-log');
      }
    }
  });
}

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const firstInput = overlay.querySelector('input');
  if (firstInput) setTimeout(() => firstInput.focus(), 150);
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  if (id === 'modal-track') {
    document.getElementById('track-result-area').innerHTML = '';
    document.getElementById('btn-save-to-history').style.display = 'none';
    document.getElementById('track-flight-input').value = '';
  }
}

/* ── Track Live Flight Handler ──────────────────────────────── */
async function handleTrackSubmit() {
  const input = document.getElementById('track-flight-input');
  const flightNumber = input.value.trim();

  if (!flightNumber) {
    input.focus();
    showToast('Please enter a flight number.', 'error');
    return;
  }

  const resultArea = document.getElementById('track-result-area');
  const submitBtn = document.getElementById('btn-track-submit');
  const saveBtn = document.getElementById('btn-save-to-history');

  resultArea.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; color:var(--text-muted); padding:16px 0; font-size:13px;">
      <div class="spinner"></div> Fetching live telemetry for <strong style="color:var(--accent-orange); font-family:var(--font-mono);">${escHtml(flightNumber.toUpperCase())}</strong>...
    </div>
  `;
  saveBtn.style.display = 'none';
  submitBtn.disabled = true;

  try {
    const data = await trackLiveFlight(flightNumber);
    state.liveFlightData = data;

    resultArea.innerHTML = buildFlightResultCard(data);
    saveBtn.style.display = 'inline-flex';

    showTracker(data);

    const perf = await loadRoutePerformance(data.flight_number || flightNumber);
    showRoutePerformance(data.flight_number || flightNumber, perf);

    showToast(`Flight ${(data.flight_number || flightNumber).toUpperCase()} tracking active!`, 'success');

  } catch (err) {
    resultArea.innerHTML = `
      <div style="color:var(--accent-orange); background:var(--accent-orange-dim); border:1px solid rgba(255,106,0,0.3);
           border-radius:8px; padding:14px; font-size:13px; margin-top:8px; display:flex; gap:10px; align-items:flex-start;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escHtml(err.message)}</span>
      </div>
    `;
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function buildFlightResultCard(data) {
  const pct = typeof data.progress_percent === 'number' ? data.progress_percent.toFixed(1) : '—';
  const status = data.status || 'In Flight';
  const statusColor = status.toLowerCase().includes('arrived') ? 'var(--accent-green)'
    : status.toLowerCase().includes('scheduled') ? 'var(--accent-cyan)'
    : 'var(--accent-orange)';

  return `
    <div style="margin-top:16px; background:#081424; border:1px solid rgba(255,106,0,0.25);
         border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div style="font-family:var(--font-mono); font-size:22px; color:var(--text-white); font-weight:700;">
          ${escHtml(data.origin_airport || '—')}
          <span style="color:var(--accent-orange); margin:0 8px;">→</span>
          ${escHtml(data.destination_airport || '—')}
        </div>
        <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
             color:${statusColor}; background:${statusColor}20; border:1px solid ${statusColor}40;
             border-radius:100px; padding:3px 12px;">
          ${escHtml(status)}
        </span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
        ${buildMetaCell('Aircraft', data.aircraft_model || '—')}
        ${buildMetaCell('Tail #', data.tail_number || '—')}
        ${buildMetaCell('Progress', pct + '%')}
        ${buildMetaCell('Speed', data.groundspeed ? data.groundspeed + ' kts' : '—')}
        ${buildMetaCell('Altitude', data.altitude ? Number(data.altitude).toLocaleString() + ' ft' : '—')}
        ${buildMetaCell('Duration', data.duration_minutes ? fmtMinutes(data.duration_minutes) : '—')}
      </div>
    </div>
  `;
}

function buildMetaCell(label, value) {
  return `
    <div style="display:flex; flex-direction:column; gap:2px;">
      <span style="font-family:var(--font-title); font-size:10px; font-weight:700; letter-spacing:0.1em; color:var(--text-dim);">${label}</span>
      <span style="font-family:var(--font-mono); font-size:13px; font-weight:600; color:var(--text-white);">${escHtml(String(value))}</span>
    </div>
  `;
}

async function handleSaveToHistory() {
  if (!state.liveFlightData) return;

  const btn = document.getElementById('btn-save-to-history');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div> Saving...';

  try {
    await saveFlightToHistory(state.liveFlightData);
    showToast('Flight saved to history database!', 'success');
    closeModal('modal-track');
    await Promise.all([loadAnalytics(), loadMilestones(), loadAvailableDates()]);
  } catch (err) {
    if (err.status === 409) {
      showToast('This flight record already exists in your history.', 'info');
      closeModal('modal-track');
    } else {
      showToast(err.message || 'Failed to save flight.', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save to History
    `;
  }
}

/* ── Log Past Flight Handler ────────────────────────────────── */
async function handleLogFlightSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('btn-log-submit');

  const flightNum = form.flight_number.value.trim();
  const origin = form.origin_airport.value.trim();
  const dest = form.destination_airport.value.trim();

  if (!flightNum || !origin || !dest) {
    showToast('Please fill in all required fields (*).', 'error');
    return;
  }

  if (origin.toUpperCase() === dest.toUpperCase()) {
    showToast('Origin and destination cannot be the same airport.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div> Logging...';

  const formData = {
    flight_number: flightNum,
    origin_airport: origin,
    destination_airport: dest,
    aircraft_model: form.aircraft_model.value.trim() || null,
    tail_number: form.tail_number.value.trim() || null,
    departure_time: form.departure_time.value || null,
    arrival_time: form.arrival_time.value || null,
    duration_minutes: form.duration_minutes.value || null,
  };

  try {
    await logManualFlight(formData);
    showToast(`Flight ${flightNum.toUpperCase()} logged successfully!`, 'success');
    form.reset();
    closeModal('modal-log');
    await Promise.all([loadAnalytics(), loadMilestones(), loadAvailableDates()]);

    // Also update tracker with newly logged flight
    showTracker({
      flight_number: formData.flight_number,
      origin_airport: formData.origin_airport,
      destination_airport: formData.destination_airport,
      aircraft_model: formData.aircraft_model || 'B738',
      tail_number: formData.tail_number || 'N101AA',
      groundspeed: 450,
      altitude: 31000,
      progress_percent: 100,
      status: 'Landed',
      duration_minutes: formData.duration_minutes || 140,
    });
  } catch (err) {
    if (err.status === 409) {
      showToast('This flight already exists in your database.', 'info');
    } else {
      showToast(err.message || 'Failed to log flight.', 'error');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Log Flight
    `;
  }
}

/* ════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : type === 'error'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  toast.innerHTML = `${icon}<span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

/* ════════════════════════════════════════════
   UTILITY FUNCTIONS
   ════════════════════════════════════════════ */

async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  try {
    const resp = await fetch(url, options);
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ detail: resp.statusText }));
      const err = new Error(errBody.detail || `HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    return await resp.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netErr = new Error('Cannot connect to backend server.');
      netErr.status = 0;
      throw netErr;
    }
    throw err;
  }
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMinutes(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
