// ---- Theme ----
const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', savedTheme);

// ---- Auth State ----
let authToken = localStorage.getItem('auth_token') || null;
let isAuthed = false;

// ---- Data State ----
let servers = new Map(); // id -> ServerStatus

// ---- DOM refs ----
const grid = document.getElementById('server-grid');
const emptyState = document.getElementById('empty-state');
const modal = document.getElementById('modal-overlay');
const form = document.getElementById('server-form');
const modalTitle = document.getElementById('modal-title');
const connStatus = document.getElementById('connection-status');
const btnAddServer = document.getElementById('btn-add-server');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsForm = document.getElementById('settings-form');
const headerActions = document.querySelector('.header-actions');
const btnTheme = document.getElementById('btn-theme');

// ---- Event Listeners ----
btnAddServer.addEventListener('click', () => openModal());
btnLogin.addEventListener('click', () => loginOverlay.classList.remove('hidden'));
btnLogout.addEventListener('click', handleLogout);
document.getElementById('btn-login-close').addEventListener('click', () => loginOverlay.classList.add('hidden'));
loginOverlay.addEventListener('click', (e) => { if (e.target === loginOverlay) loginOverlay.classList.add('hidden'); });
loginForm.addEventListener('submit', handleLogin);
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
form.addEventListener('submit', handleFormSubmit);
document.getElementById('btn-settings-close').addEventListener('click', () => settingsOverlay.classList.add('hidden'));
document.getElementById('btn-settings-cancel').addEventListener('click', () => settingsOverlay.classList.add('hidden'));
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden'); });
settingsForm.addEventListener('submit', handleSettingsSave);
btnTheme.addEventListener('click', toggleTheme);
updateThemeIcon();

// ---- Init ----
checkAuthStatus().then(() => {
    fetchServers();
    connectSSE();
});

// ---- Auth ----

function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
}

async function checkAuthStatus() {
    if (!authToken) {
        setAuthUI(false);
        return;
    }
    try {
        const res = await fetch('/api/auth/status', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        setAuthUI(data.authenticated);
        if (!data.authenticated) {
            authToken = null;
            localStorage.removeItem('auth_token');
        }
    } catch {
        setAuthUI(false);
    }
}

function setAuthUI(authed) {
    isAuthed = authed;
    btnAddServer.classList.toggle('hidden', !authed);
    btnLogin.classList.toggle('hidden', authed);
    btnLogout.classList.toggle('hidden', !authed);

    // Dynamically add/remove settings button
    const existing = document.getElementById('btn-settings');
    if (authed && !existing) {
        const btn = document.createElement('button');
        btn.id = 'btn-settings';
        btn.className = 'btn';
        btn.textContent = 'Settings';
        btn.addEventListener('click', openSettings);
        headerActions.insertBefore(btn, btnAddServer);
    } else if (!authed && existing) {
        existing.remove();
    }

    // Re-render to show/hide sensitive info
    renderAll();
}

async function handleLogin(e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            loginError.textContent = 'Invalid username or password';
            loginError.classList.remove('hidden');
            return;
        }
        const data = await res.json();
        authToken = data.token;
        localStorage.setItem('auth_token', authToken);
        loginOverlay.classList.add('hidden');
        loginForm.reset();
        setAuthUI(true);
        fetchServers(); // Re-fetch with auth to get full data
    } catch {
        loginError.textContent = 'Login failed';
        loginError.classList.remove('hidden');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
    } catch { /* ignore */ }
    authToken = null;
    localStorage.removeItem('auth_token');
    setAuthUI(false);
    fetchServers(); // Re-fetch without auth to get public data
}

// ---- API ----

async function fetchServers() {
    try {
        const res = await fetch('/api/servers', { headers: authHeaders() });
        const data = await res.json();
        servers.clear();
        data.forEach(s => servers.set(s.server.id, s));
        renderAll();
    } catch (e) {
        console.error('Failed to fetch servers:', e);
    }
}

function connectSSE() {
    const evtSource = new EventSource('/api/events');

    evtSource.onopen = () => {
        connStatus.textContent = 'Connected';
        connStatus.className = 'badge badge-green';
    };

    evtSource.onerror = () => {
        connStatus.textContent = 'Disconnected';
        connStatus.className = 'badge badge-red';
    };

    evtSource.onmessage = (e) => {
        const event = JSON.parse(e.data);
        switch (event.type) {
            case 'Snapshot':
                // SSE only carries public data (no host/port/password)
                // Always fetch full data via authenticated REST API
                fetchServers();
                break;
            case 'CheckComplete':
                handleCheckResult(event.result);
                break;
            case 'ServerUpdated':
                // Server changed — re-fetch via REST to get full/public data
                fetchServers();
                break;
            case 'ServerRemoved':
                servers.delete(event.server_id);
                renderAll();
                break;
        }
    };
}

function handleCheckResult(result) {
    const status = servers.get(result.server_id);
    if (!status) return;

    status.latest_result = result;
    status.history.unshift(result);
    if (status.history.length > 100) status.history.pop();

    const tcpUp = status.history.filter(r => r.tcp_check.reachable).length;
    status.uptime_pct = status.history.length > 0 ? (tcpUp / status.history.length) * 100 : 0;

    const latencies = status.history.map(r => r.tcp_check.latency_ms).filter(l => l != null);
    status.avg_latency_ms = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null;

    renderCard(status);
}

function handleServerUpdated(server) {
    let status = servers.get(server.id);
    if (status) {
        status.server = server;
    } else {
        status = { server, latest_result: null, history: [], uptime_pct: 0, avg_latency_ms: null };
        servers.set(server.id, status);
    }
    renderAll();
}

async function createServer(data) {
    const res = await fetch('/api/servers', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    if (res.status === 401) { setAuthUI(false); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function updateServer(id, data) {
    const res = await fetch(`/api/servers/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    if (res.status === 401) { setAuthUI(false); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function deleteServer(id) {
    const res = await fetch(`/api/servers/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { setAuthUI(false); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await res.text());
}

async function triggerCheck(id) {
    const btn = document.querySelector(`[data-check-id="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
        const res = await fetch(`/api/servers/${id}/check`, { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Check'; }
    }
}

// ---- Rendering ----

function renderAll() {
    if (servers.size === 0) {
        grid.innerHTML = '';
        grid.appendChild(emptyState);
        emptyState.style.display = '';
        return;
    }

    emptyState.style.display = 'none';

    const existingIds = new Set();
    grid.querySelectorAll('.server-card').forEach(el => existingIds.add(el.dataset.id));

    existingIds.forEach(id => {
        if (!servers.has(id)) {
            const el = grid.querySelector(`[data-id="${id}"]`);
            if (el) el.remove();
        }
    });

    servers.forEach(status => renderCard(status));
}

function renderCard(status) {
    const { server } = status;
    let card = grid.querySelector(`[data-id="${server.id}"]`);

    if (!card) {
        card = document.createElement('div');
        card.className = 'server-card';
        card.dataset.id = server.id;
        grid.appendChild(card);
    }

    const tcp = status.latest_result?.tcp_check;
    const ss = status.latest_result?.ss_check;

    const isUp = tcp?.reachable ?? false;
    const ssOk = ss?.success ?? false;

    let statusClass;
    if (!server.enabled) {
        statusClass = 'disabled';
    } else if (!status.latest_result) {
        statusClass = 'pending';
    } else if (isUp && ssOk) {
        statusClass = 'up';
    } else if (isUp && !ssOk) {
        statusClass = 'degraded';
    } else {
        statusClass = 'down';
    }

    const latencyStr = tcp?.latency_ms != null ? `${tcp.latency_ms.toFixed(1)}` : '--';
    const latencyClass = tcp?.latency_ms == null ? 'na' :
        tcp.latency_ms < 200 ? 'good' : tcp.latency_ms < 500 ? 'warn' : 'bad';

    const uptimeStr = status.history.length > 0 ? `${status.uptime_pct.toFixed(1)}%` : '--';
    const uptimeClass = status.uptime_pct >= 95 ? 'good' :
        status.uptime_pct >= 80 ? 'warn' : (status.history.length > 0 ? 'bad' : 'na');

    const avgStr = status.avg_latency_ms != null ? `${status.avg_latency_ms.toFixed(1)}` : '--';
    const avgClass = status.avg_latency_ms == null ? 'na' :
        status.avg_latency_ms < 200 ? 'good' : status.avg_latency_ms < 500 ? 'warn' : 'bad';

    const tagsHtml = server.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');

    // Address line: only show when authed
    const addressHtml = isAuthed && server.host
        ? `<div class="card-address">${esc(server.host)}:${server.port}</div>`
        : '';

    // SS protocol check result display (only show method when authed)
    let ssHtml = '';
    if (ss) {
        const methodLabel = isAuthed && server.method ? esc(server.method) : 'Protocol';
        const ssBadge = ss.success
            ? `<span class="badge badge-green">OK${ss.latency_ms ? ` ${ss.latency_ms.toFixed(0)}ms` : ''}</span>`
            : `<span class="badge badge-red">FAIL</span>`;
        const ssError = (!ss.success && ss.error && isAuthed) ? `<div class="ss-error">${esc(ss.error)}</div>` : '';
        ssHtml = `
            <div class="ss-status">
                <span>SS ${methodLabel}</span>
                ${ssBadge}
            </div>
            ${ssError}
        `;
    }

    // Action buttons: only show edit/delete when authed
    let actionsHtml = '';
    if (isAuthed) {
        actionsHtml = `
            <div class="card-actions">
                <button class="btn btn-sm" data-check-id="${server.id}" onclick="triggerCheck('${server.id}')">Check</button>
                <button class="btn btn-sm" onclick="openEditModal('${server.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="confirmDelete('${server.id}')">Del</button>
            </div>
        `;
    }

    // Latency chart
    const chartEntries = status.history.slice(0, 20).reverse();
    const maxLatency = Math.max(1, ...chartEntries.map(r => r.tcp_check.latency_ms ?? 0));
    const barsHtml = chartEntries.map(r => {
        if (!r.tcp_check.reachable) return `<div class="latency-bar down" style="height:100%"></div>`;
        const ms = r.tcp_check.latency_ms ?? 0;
        const pct = Math.max(4, (ms / maxLatency) * 100);
        const cls = ms < 200 ? 'up' : ms < 500 ? 'slow' : 'down';
        return `<div class="latency-bar ${cls}" style="height:${pct}%" title="${ms.toFixed(1)}ms"></div>`;
    }).join('');

    const lastCheck = status.latest_result
        ? timeAgo(new Date(status.latest_result.timestamp))
        : 'Never';

    card.innerHTML = `
        <div class="card-header">
            <div class="card-title">
                <span class="status-dot ${statusClass}"></span>
                <h3>${esc(server.name)}</h3>
            </div>
            ${actionsHtml}
        </div>
        ${addressHtml}
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
        <div class="card-stats">
            <div class="stat">
                <div class="stat-value ${latencyClass}">${latencyStr}<small>${tcp?.latency_ms != null ? 'ms' : ''}</small></div>
                <div class="stat-label">TCP Latency</div>
            </div>
            <div class="stat">
                <div class="stat-value ${uptimeClass}">${uptimeStr}</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat">
                <div class="stat-value ${avgClass}">${avgStr}<small>${status.avg_latency_ms != null ? 'ms' : ''}</small></div>
                <div class="stat-label">Avg</div>
            </div>
        </div>
        ${ssHtml}
        ${chartEntries.length > 0 ? `<div class="latency-chart">${barsHtml}</div>` : ''}
        <div class="card-footer">
            <span>Last check: ${lastCheck}</span>
            <span>${status.history.length} checks</span>
        </div>
    `;
}

// ---- Server Modal ----

function openModal() {
    if (!isAuthed) return;
    modalTitle.textContent = 'Add Server';
    form.reset();
    document.getElementById('form-id').value = '';
    document.getElementById('form-port').value = '8388';
    document.getElementById('form-method').value = 'aes-256-gcm';
    document.getElementById('form-enabled').checked = true;
    modal.classList.remove('hidden');
}

function openEditModal(id) {
    if (!isAuthed) return;
    const status = servers.get(id);
    if (!status) return;
    const s = status.server;

    modalTitle.textContent = 'Edit Server';
    document.getElementById('form-id').value = s.id;
    document.getElementById('form-name').value = s.name;
    document.getElementById('form-host').value = s.host;
    document.getElementById('form-port').value = s.port;
    document.getElementById('form-password').value = s.password;
    document.getElementById('form-method').value = s.method;
    document.getElementById('form-tags').value = s.tags.join(', ');
    document.getElementById('form-enabled').checked = s.enabled;
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('form-id').value;
    const tagsRaw = document.getElementById('form-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t) : [];

    const data = {
        name: document.getElementById('form-name').value,
        host: document.getElementById('form-host').value,
        port: parseInt(document.getElementById('form-port').value, 10),
        password: document.getElementById('form-password').value,
        method: document.getElementById('form-method').value,
        enabled: document.getElementById('form-enabled').checked,
        tags,
    };

    try {
        if (id) {
            await updateServer(id, data);
        } else {
            await createServer(data);
        }
        closeModal();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function confirmDelete(id) {
    if (!isAuthed) return;
    const status = servers.get(id);
    if (!status) return;
    if (!confirm(`Delete server "${status.server.name}"?`)) return;
    try {
        await deleteServer(id);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ---- Theme ----

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon();
}

function updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    btnTheme.textContent = theme === 'dark' ? '\u{2600}' : '\u{1F319}';
    btnTheme.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

// ---- Settings ----

async function openSettings() {
    if (!isAuthed) return;
    try {
        const res = await fetch('/api/settings', { headers: authHeaders() });
        if (res.status === 401) { setAuthUI(false); return; }
        const data = await res.json();
        document.getElementById('settings-interval').value = data.check_interval_secs;
    } catch (e) {
        console.error('Failed to fetch settings:', e);
    }
    settingsOverlay.classList.remove('hidden');
}

async function handleSettingsSave(e) {
    e.preventDefault();
    const interval = parseInt(document.getElementById('settings-interval').value, 10);
    if (isNaN(interval) || interval < 5) {
        alert('Interval must be at least 5 seconds');
        return;
    }
    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ check_interval_secs: interval }),
        });
        if (res.status === 401) { setAuthUI(false); return; }
        if (!res.ok) { alert('Error: ' + await res.text()); return; }
        settingsOverlay.classList.add('hidden');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ---- Utils ----

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function timeAgo(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

window.triggerCheck = triggerCheck;
window.openEditModal = openEditModal;
window.confirmDelete = confirmDelete;
