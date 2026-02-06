// ---- i18n ----
const i18n = {
    en: {
        // Header
        title: 'SS Server Monitor',
        connecting: 'Connecting...',
        connected: 'Connected',
        disconnected: 'Disconnected',
        addServer: '+ Add Server',
        login: 'Login',
        logout: 'Logout',
        settings: 'Settings',
        // Empty state
        emptyState: 'No servers configured. Add a server to start monitoring.',
        // Card
        tcpLatency: 'TCP Latency',
        uptime: 'Uptime',
        avg: 'Avg',
        lastCheck: 'Last check',
        checks: 'checks',
        never: 'Never',
        check: 'Check',
        edit: 'Edit',
        del: 'Del',
        protocol: 'Protocol',
        // Time
        justNow: 'just now',
        secsAgo: 's ago',
        minsAgo: 'm ago',
        hrsAgo: 'h ago',
        daysAgo: 'd ago',
        // Login modal
        loginTitle: 'Login',
        username: 'Username',
        password: 'Password',
        loginBtn: 'Login',
        loginInvalid: 'Invalid username or password',
        loginFailed: 'Login failed',
        // Server modal
        addServerTitle: 'Add Server',
        editServerTitle: 'Edit Server',
        name: 'Name',
        host: 'Host',
        port: 'Port',
        ssPassword: 'Password',
        encMethod: 'Encryption Method',
        tags: 'Tags (comma separated)',
        enabled: 'Enabled',
        cancel: 'Cancel',
        save: 'Save',
        // Settings modal
        settingsTitle: 'Settings',
        checkInterval: 'Check Interval (seconds)',
        checkIntervalHint: 'Min 5s, how often to check all servers',
        intervalError: 'Interval must be at least 5 seconds',
        // Errors
        error: 'Error: ',
        deleteConfirm: 'Delete server',
        invalidHost: 'Invalid host: please enter a valid IP address or domain name',
        invalidPort: 'Invalid port: must be between 1 and 65535',
        // Theme
        switchLight: 'Switch to light mode',
        switchDark: 'Switch to dark mode',
        // Optgroups
        aeadGroup: 'AEAD',
        aead2022Group: 'AEAD 2022',
        streamGroup: 'Stream (legacy)',
        // Placeholders
        phName: 'e.g. Tokyo-01',
        phHost: 'e.g. 103.45.67.89',
        phPassword: 'SS password',
        phTags: 'e.g. jp, premium',
    },
    zh: {
        title: 'SS 服务器监控',
        connecting: '连接中...',
        connected: '已连接',
        disconnected: '已断开',
        addServer: '+ 添加服务器',
        login: '登录',
        logout: '退出',
        settings: '设置',
        emptyState: '未配置服务器，请添加服务器以开始监控。',
        tcpLatency: 'TCP 延迟',
        uptime: '在线率',
        avg: '均值',
        lastCheck: '上次检查',
        checks: '次检查',
        never: '从未',
        check: '检查',
        edit: '编辑',
        del: '删除',
        protocol: '协议',
        justNow: '刚刚',
        secsAgo: '秒前',
        minsAgo: '分钟前',
        hrsAgo: '小时前',
        daysAgo: '天前',
        loginTitle: '登录',
        username: '用户名',
        password: '密码',
        loginBtn: '登录',
        loginInvalid: '用户名或密码错误',
        loginFailed: '登录失败',
        addServerTitle: '添加服务器',
        editServerTitle: '编辑服务器',
        name: '名称',
        host: '主机',
        port: '端口',
        ssPassword: '密码',
        encMethod: '加密方式',
        tags: '标签（逗号分隔）',
        enabled: '启用',
        cancel: '取消',
        save: '保存',
        settingsTitle: '设置',
        checkInterval: '检查间隔（秒）',
        checkIntervalHint: '最少 5 秒，检查所有服务器的频率',
        intervalError: '间隔至少为 5 秒',
        error: '错误：',
        deleteConfirm: '删除服务器',
        invalidHost: '主机地址无效：请输入有效的 IP 地址或域名',
        invalidPort: '端口无效：必须在 1 到 65535 之间',
        switchLight: '切换到浅色模式',
        switchDark: '切换到深色模式',
        aeadGroup: 'AEAD',
        aead2022Group: 'AEAD 2022',
        streamGroup: 'Stream（旧版）',
        phName: '例如 Tokyo-01',
        phHost: '例如 103.45.67.89',
        phPassword: 'SS 密码',
        phTags: '例如 jp, premium',
    }
};

const browserLang = (navigator.language || '').startsWith('zh') ? 'zh' : 'en';
let currentLang = localStorage.getItem('lang') || browserLang;

function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || key;
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyI18nToHTML();
    renderAll();
    updateThemeIcon();
    updateLangBtn();
    // Update SSE status badge text
    const cls = connStatus.className;
    if (cls.includes('badge-green')) connStatus.textContent = t('connected');
    else if (cls.includes('badge-red')) connStatus.textContent = t('disconnected');
    else connStatus.textContent = t('connecting');
}

function applyI18nToHTML() {
    document.title = t('title');
    document.querySelector('header h1').textContent = t('title');
    btnAddServer.textContent = t('addServer');
    btnLogin.textContent = t('login');
    btnLogout.textContent = t('logout');
    document.querySelector('#empty-state p').textContent = t('emptyState');
    // Connection status is updated separately

    // Login modal
    document.querySelector('#login-overlay .modal-header h2').textContent = t('loginTitle');
    document.querySelector('label[for="login-username"]').textContent = t('username');
    document.querySelector('label[for="login-password"]').textContent = t('password');
    document.querySelector('#login-form button[type="submit"]').textContent = t('loginBtn');

    // Server modal
    document.querySelector('label[for="form-name"]').textContent = t('name');
    document.querySelector('label[for="form-host"]').textContent = t('host');
    document.querySelector('label[for="form-port"]').textContent = t('port');
    document.querySelector('label[for="form-password"]').textContent = t('ssPassword');
    document.querySelector('label[for="form-method"]').textContent = t('encMethod');
    document.querySelector('label[for="form-tags"]').textContent = t('tags');
    document.querySelector('#form-enabled').parentElement.childNodes[1].textContent = ' ' + t('enabled');
    document.getElementById('form-name').placeholder = t('phName');
    document.getElementById('form-host').placeholder = t('phHost');
    document.getElementById('form-password').placeholder = t('phPassword');
    document.getElementById('form-tags').placeholder = t('phTags');
    document.getElementById('btn-cancel').textContent = t('cancel');
    document.querySelector('#server-form button[type="submit"]').textContent = t('save');

    // Optgroups
    const optgroups = document.querySelectorAll('#form-method optgroup');
    if (optgroups[0]) optgroups[0].label = t('aeadGroup');
    if (optgroups[1]) optgroups[1].label = t('aead2022Group');
    if (optgroups[2]) optgroups[2].label = t('streamGroup');

    // Settings modal
    document.querySelector('#settings-overlay .modal-header h2').textContent = t('settingsTitle');
    document.querySelector('label[for="settings-interval"]').textContent = t('checkInterval');
    document.querySelector('#settings-form .form-hint').textContent = t('checkIntervalHint');
    document.getElementById('btn-settings-cancel').textContent = t('cancel');
    document.querySelector('#settings-form button[type="submit"]').textContent = t('save');

    // Settings button if exists
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.textContent = t('settings');
}

function updateLangBtn() {
    btnLang.textContent = currentLang === 'zh' ? 'EN' : '中';
    btnLang.title = currentLang === 'zh' ? 'Switch to English' : '切换到中文';
}

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
const btnLang = document.getElementById('btn-lang');

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
btnLang.addEventListener('click', () => setLang(currentLang === 'zh' ? 'en' : 'zh'));
updateThemeIcon();
updateLangBtn();
applyI18nToHTML();

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
        btn.textContent = t('settings');
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
            loginError.textContent = t('loginInvalid');
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
        loginError.textContent = t('loginFailed');
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
        connStatus.textContent = t('connected');
        connStatus.className = 'badge badge-green';
    };

    evtSource.onerror = () => {
        connStatus.textContent = t('disconnected');
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
    status.total_checks = (status.total_checks || 0) + 1;

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
        await fetchServers();
    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = t('check'); }
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
        const methodLabel = isAuthed && server.method ? esc(server.method) : t('protocol');
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
                <button class="btn btn-sm" data-check-id="${server.id}" onclick="triggerCheck('${server.id}')">${t('check')}</button>
                <button class="btn btn-sm" onclick="openEditModal('${server.id}')">${t('edit')}</button>
                <button class="btn btn-sm btn-danger" onclick="confirmDelete('${server.id}')">${t('del')}</button>
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
        : t('never');

    const totalChecks = status.total_checks ?? status.history.length;

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
                <div class="stat-label">${t('tcpLatency')}</div>
            </div>
            <div class="stat">
                <div class="stat-value ${uptimeClass}">${uptimeStr}</div>
                <div class="stat-label">${t('uptime')}</div>
            </div>
            <div class="stat">
                <div class="stat-value ${avgClass}">${avgStr}<small>${status.avg_latency_ms != null ? 'ms' : ''}</small></div>
                <div class="stat-label">${t('avg')}</div>
            </div>
        </div>
        ${ssHtml}
        ${chartEntries.length > 0 ? `<div class="latency-chart">${barsHtml}</div>` : ''}
        <div class="card-footer">
            <span>${t('lastCheck')}: ${lastCheck}</span>
            <span>${totalChecks} ${t('checks')}</span>
        </div>
    `;
}

// ---- Server Modal ----

function openModal() {
    if (!isAuthed) return;
    modalTitle.textContent = t('addServerTitle');
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

    modalTitle.textContent = t('editServerTitle');
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

    const host = document.getElementById('form-host').value.trim();
    const port = parseInt(document.getElementById('form-port').value, 10);

    if (!isValidHost(host)) {
        alert(t('invalidHost'));
        return;
    }
    if (isNaN(port) || port < 1 || port > 65535) {
        alert(t('invalidPort'));
        return;
    }

    const data = {
        name: document.getElementById('form-name').value,
        host,
        port,
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
        alert(t('error') + err.message);
    }
}

async function confirmDelete(id) {
    if (!isAuthed) return;
    const status = servers.get(id);
    if (!status) return;
    if (!confirm(`${t('deleteConfirm')} "${status.server.name}"?`)) return;
    try {
        await deleteServer(id);
    } catch (err) {
        alert(t('error') + err.message);
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
    btnTheme.title = theme === 'dark' ? t('switchLight') : t('switchDark');
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
        alert(t('intervalError'));
        return;
    }
    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ check_interval_secs: interval }),
        });
        if (res.status === 401) { setAuthUI(false); return; }
        if (!res.ok) { alert(t('error') + await res.text()); return; }
        settingsOverlay.classList.add('hidden');
    } catch (err) {
        alert(t('error') + err.message);
    }
}

// ---- Utils ----

function isValidHost(host) {
    if (!host) return false;
    // IPv4
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const m = host.match(ipv4);
    if (m) return m.slice(1).every(n => parseInt(n, 10) <= 255);
    // IPv6 (simplified: brackets optional)
    const bare = host.replace(/^\[|\]$/g, '');
    if (/^[0-9a-fA-F:]+$/.test(bare) && bare.includes(':')) return true;
    // Domain name
    return /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$/.test(host);
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function timeAgo(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 5) return t('justNow');
    if (secs < 60) return `${secs}${t('secsAgo')}`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}${t('minsAgo')}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t('hrsAgo')}`;
    return `${Math.floor(hrs / 24)}${t('daysAgo')}`;
}

window.triggerCheck = triggerCheck;
window.openEditModal = openEditModal;
window.confirmDelete = confirmDelete;
