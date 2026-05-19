// =============================================================================
// NexStep — UI: Calendar
// Renders a dynamic calendar populated from Supabase intel deadlines.
// =============================================================================

import { fetchUpcomingDeadlines } from '../api/intel.js';
import { getCurrentCollegeId } from '../auth.js';

let _currentYear  = new Date().getFullYear();
let _currentMonth = new Date().getMonth(); // 0-indexed
let _deadlines    = [];

/**
 * Initialize and render the calendar.
 */
export async function renderCalendar() {
  const collegeId = getCurrentCollegeId();

  // Fetch 60 days of upcoming deadlines
  if (collegeId) {
    _deadlines = await fetchUpcomingDeadlines(collegeId, 60);
  }

  renderCalendarGrid(_currentYear, _currentMonth);
  renderUpcomingEventsList();
}

/** Navigate to previous month */
export function calPrevMonth() {
  if (_currentMonth === 0) { _currentMonth = 11; _currentYear--; }
  else _currentMonth--;
  renderCalendarGrid(_currentYear, _currentMonth);
}

/** Navigate to next month */
export function calNextMonth() {
  if (_currentMonth === 11) { _currentMonth = 0; _currentYear++; }
  else _currentMonth++;
  renderCalendarGrid(_currentYear, _currentMonth);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderCalendarGrid(year, month) {
  // Update header title
  const titleEl = document.querySelector('.card .card-title');
  if (titleEl) {
    titleEl.textContent = new Date(year, month).toLocaleDateString('en-IN', {
      month: 'long', year: 'numeric',
    });
  }

  // Build deadline date-to-urgency map for this month
  const deadlineMap = {}; // key: "YYYY-MM-DD", value: urgency
  _deadlines.forEach(d => {
    const dt  = new Date(d.deadline_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    // Use the most urgent one if multiple on same day
    const existing = deadlineMap[key];
    if (!existing || urgencyRank(d.urgency) > urgencyRank(existing)) {
      deadlineMap[key] = d.urgency;
    }
  });

  const today      = new Date();
  const firstDay   = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMon  = new Date(year, month + 1, 0).getDate();
  const prevDays   = new Date(year, month, 0).getDate();

  const calGrid = document.querySelector('.calendar-grid');
  if (!calGrid) return;

  // Keep day labels (first 7 children)
  const labels = Array.from(calGrid.querySelectorAll('.cal-day-label'));
  calGrid.innerHTML = '';
  labels.forEach(l => calGrid.appendChild(l));

  // Blank cells from previous month
  for (let i = 0; i < firstDay; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day inactive';
    d.textContent = prevDays - firstDay + 1 + i;
    calGrid.appendChild(d);
  }

  // Days of current month
  for (let day = 1; day <= daysInMon; day++) {
    const d    = document.createElement('div');
    const key  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = year === today.getFullYear() &&
                    month === today.getMonth() &&
                    day   === today.getDate();

    d.textContent = day;
    d.className = 'cal-day';
    if (isToday) d.classList.add('today');

    if (deadlineMap[key]) {
      d.classList.add(deadlineMap[key] === 'urgent' || deadlineMap[key] === 'high'
        ? 'has-event'
        : 'has-event-amber'
      );
      d.title = `Deadline on this day`;
    }

    calGrid.appendChild(d);
  }

  // Fill remaining cells
  const totalCells = firstDay + daysInMon;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day inactive';
    d.textContent = i;
    calGrid.appendChild(d);
  }
}

function renderUpcomingEventsList() {
  const container = document.querySelector('.widget .widget-body .deadline-list');
  if (!container) return;

  if (!_deadlines.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">
        No upcoming deadlines found.
      </div>
    `;
    return;
  }

  // Show next 5 deadlines
  const upcoming = _deadlines.slice(0, 5);
  container.innerHTML = upcoming.map(d => {
    const dt       = new Date(d.deadline_at);
    const dotClass = d.urgency === 'urgent' ? 'red' : d.urgency === 'high' ? 'amber' : 'blue';
    const dateStr  = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="deadline-item">
        <div class="deadline-dot ${dotClass}"></div>
        <div>
          <div class="deadline-text" style="font-weight:600;">${escapeHTML(d.title)}</div>
          <div class="deadline-when">📅 ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function urgencyRank(u) {
  return { urgent: 3, high: 2, medium: 1 }[u] ?? 0;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[t])
  );
}
