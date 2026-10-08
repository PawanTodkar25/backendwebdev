const API_BASE = '/api';

let events = [];
let attendees = [];

const eventName = (e) => e.name ?? '';
const eventDate = (e) => e.date ?? '';
const eventVenue = (e) => e.venue ?? '';
const eventCapacity = (e) => Number(e.capacity ?? 0);
const eventId = (e) => e.id ?? e.eventId;

const attName = (a) => a.name ?? '';
const attEmail = (a) => a.email ?? '';
const attTicket = (a) => a.ticketType ?? a.ticket_type ?? 'Standard';
const attEventId = (a) => a.eventId ?? a.event_id ?? '';
const attEventName = (a) => a.eventName ?? a.event_name ?? '';
const attId = (a) => a.id ?? a.attendeeId;

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function tierClass(tier) {
  const t = (tier || '').toLowerCase();
  if (t === 'vip') return 'tier-vip';
  if (t.includes('early')) return 'tier-earlybird';
  return 'tier-standard';
}

function registeredCountFor(id) {
  return attendees.filter(a => String(attEventId(a)) === String(id)).length;
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// SECURE API REQUESTER
async function apiRequest(path, options) {
  // Grabs the password directly from the navbar input
  const pwdEl = document.getElementById('admin-pwd');
  const password = pwdEl ? pwdEl.value : '';
  
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 
        'Content-Type': 'application/json',
        'x-admin-password': password 
    },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch { }
  if (!res.ok) throw new Error(body?.message || body?.error || `Request failed (${res.status})`);
  return body;
}

async function fetchAllData() {
  try {
    const [evtRes, attRes] = await Promise.all([
      fetch(`${API_BASE}/events`),
      fetch(`${API_BASE}/attendees`)
    ]);
    if (evtRes.ok) events = await evtRes.json();
    if (attRes.ok) attendees = await attRes.json();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

function populateEventDropdown() {
  const select = document.getElementById('a-event');
  if (!select) return;
  select.innerHTML = events.length
    ? `<option value="" disabled selected>Select an event</option>` +
      events.map(e => `<option value="${eventId(e)}">${escapeHtml(eventName(e))}</option>`).join('')
    : `<option value="" disabled selected>No events yet — create one first</option>`;
}

function renderEvents() {
  const list = document.getElementById('events-list');
  const count = document.getElementById('events-count');
  if (!list) return;
  if (count) count.textContent = events.length;
  if (events.length === 0) return list.innerHTML = '';

  list.innerHTML = events.map(e => {
    const id = eventId(e);
    const capacity = eventCapacity(e);
    const registered = registeredCountFor(id);
    const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
    const fillClass = pct >= 90 ? 'fill-high' : pct >= 60 ? 'fill-mid' : 'fill-ok';

    return `
      <article class="event-ticket" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #eee; border-radius: 8px; margin-bottom: 1rem;">
        <div class="ticket-main" style="flex: 1;">
          <strong>${escapeHtml(eventName(e))}</strong>
          <div class="ticket-meta" style="color: #666; font-size: 0.9rem; margin-top: 4px;">${formatDate(eventDate(e))} · ${escapeHtml(eventVenue(e))}</div>
          <div class="ticket-capacity" style="margin-top: 8px; font-size: 0.85rem;">
            <span>${registered}/${capacity} seats</span>
            <div style="height: 6px; background: #e0e0e0; border-radius: 3px; margin-top: 4px; overflow: hidden; width: 100%; max-width: 200px;">
                <div style="height: 100%; width:${pct}%;" class="${fillClass}"></div>
            </div>
          </div>
        </div>
        <div class="ticket-side" style="text-align: right; display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
          <span style="color: #999; font-size: 0.8rem;">#${String(id).slice(-5)}</span>
          <button type="button" class="btn-danger" data-delete-event="${id}" style="background: #fee2e2; color: #dc2626; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Delete</button>
        </div>
      </article>`;
  }).join('');
}

function renderAttendees(rows) {
  const list = document.getElementById('attendees-list');
  const count = document.getElementById('attendees-count');
  if (!list) return;
  if (count) count.textContent = rows.length;
  if (rows.length === 0) return list.innerHTML = '';

  list.innerHTML = rows.map(a => {
    const name = attName(a);
    const event = attEventName(a) || events.find(e => String(eventId(e)) === String(attEventId(a)))?.name;
    return `
      <div class="attendee-row" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid #eee; border-radius: 8px; margin-bottom: 1rem;">
        <div class="avatar" style="background: #1d2340; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${initials(name)}</div>
        <div class="attendee-details" style="flex: 1; display: flex; flex-direction: column;">
          <strong style="color: #111827;">${escapeHtml(name)}</strong>
          <small style="color: #6b7280;">${escapeHtml(attEmail(a))}${event ? ' · ' + escapeHtml(event) : ''}</small>
        </div>
        <span class="tier-badge" style="background: #fef3c7; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600;">${escapeHtml(attTicket(a))}</span>
        <button type="button" class="btn-danger" data-delete-attendee="${attId(a)}" style="background: #fee2e2; color: #dc2626; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Delete</button>
      </div>`;
  }).join('');
}

async function handleEventSubmit(ev) {
    ev.preventDefault();
    const form = ev.target;
    const messageEl = document.getElementById("event-message");
    const submitBtn = form.querySelector("button[type=submit]");
    
    const payload = {
        name: document.getElementById("e-name").value.trim(),
        date: document.getElementById("e-date").value,
        venue: document.getElementById("e-venue").value.trim(),
        capacity: Number(document.getElementById("e-capacity").value)
    };

    submitBtn.disabled = true;
    try {
        await apiRequest("/events", { method: "POST", body: JSON.stringify(payload) });
        showMessage(messageEl, "Event created successfully.", "success");
        form.reset();
        await fetchAllData();
        renderEvents();
        populateEventDropdown();
    } catch (err) {
        showMessage(messageEl, err.message, "error");
    }
    submitBtn.disabled = false;
}

async function handleAttendeeSubmit(ev) {
    ev.preventDefault();
    const form = ev.target;
    const messageEl = document.getElementById("attendee-message");
    const submitBtn = form.querySelector("button[type=submit]");

    const payload = {
        event_id: document.getElementById("a-event").value,
        name: document.getElementById("a-name").value.trim(),
        email: document.getElementById("a-email").value.trim(),
        ticket_type: document.getElementById("a-ticket").value
    };

    if (!payload.event_id || !payload.name || !payload.email || !payload.ticket_type) {
        return showMessage(messageEl, "All fields are required.", "error");
    }

    submitBtn.disabled = true;
    try {
        await apiRequest("/attendees", { method: "POST", body: JSON.stringify(payload) });
        showMessage(messageEl, "Registration successful!", "success");
        form.reset();
        await fetchAllData();
        renderEvents();
        renderAttendees(attendees);
    } catch (err) {
        showMessage(messageEl, err.message, "error");
    }
    submitBtn.disabled = false;
}

async function deleteEvent(id) {
  const pwdEl = document.getElementById('admin-pwd');
  if (!pwdEl || !pwdEl.value) return alert("Please enter the Admin Password in the top right box first.");
  
  if (!confirm('Delete this event? Its attendee records will be removed too.')) return;
  
  try {
    await apiRequest(`/events/${id}`, { method: 'DELETE' });
    await fetchAllData();
    if (document.getElementById('events-list')) renderEvents();
    if (document.getElementById('a-event')) populateEventDropdown();
    if (document.getElementById('attendees-list')) renderAttendees(attendees);
  } catch (err) {
    alert(`Could not delete event: ${err.message}`);
  }
}

async function deleteAttendee(id) {
  const pwdEl = document.getElementById('admin-pwd');
  if (!pwdEl || !pwdEl.value) return alert("Please enter the Admin Password in the top right box first.");
  
  if (!confirm('Remove this attendee?')) return;
  
  try {
    await apiRequest(`/attendees/${id}`, { method: 'DELETE' });
    await fetchAllData();
    if (document.getElementById('attendees-list')) renderAttendees(attendees);
    if (document.getElementById('events-list')) renderEvents();
  } catch (err) {
    alert(`Could not delete attendee: ${err.message}`);
  }
}

// GLOBAL EVENT LISTENER FOR DELETE BUTTONS
document.addEventListener('click', (e) => {
  const deleteEvtBtn = e.target.closest('[data-delete-event]');
  if (deleteEvtBtn) deleteEvent(deleteEvtBtn.dataset.deleteEvent);
  
  const deleteAttBtn = e.target.closest('[data-delete-attendee]');
  if (deleteAttBtn) deleteAttendee(deleteAttBtn.dataset.deleteAttendee);
});

function searchAttendees() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  
  const term = searchInput.value.trim().toLowerCase();
  if (!term) return renderAttendees(attendees);

  const filteredResults = attendees.filter(a => {
    const searchName = attName(a).toLowerCase();
    const searchEvent = (attEventName(a) || events.find(e => String(eventId(e)) === String(attEventId(a)))?.name || '').toLowerCase();
    return searchName.includes(term) || searchEvent.includes(term);
  });

  renderAttendees(filteredResults);
}

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('e-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  const eventForm = document.getElementById('event-form');
  if (eventForm) eventForm.addEventListener('submit', handleEventSubmit);

  const attendeeForm = document.getElementById('attendee-form');
  if (attendeeForm) attendeeForm.addEventListener('submit', handleAttendeeSubmit);

  await fetchAllData();
  if (document.getElementById('events-list')) renderEvents();
  if (document.getElementById('a-event')) populateEventDropdown();
  if (document.getElementById('attendees-list')) renderAttendees(attendees);
});