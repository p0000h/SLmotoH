// ===== КОНФИГУРАЦИЯ =====
const STARLINE_ID_URL = 'https://id.starline.ru/apiV3';
const STARLINE_API_URL = 'https://developer.starline.ru';

const APP_ID = '50254; 
const APP_SECRET = 'JfZ5bOVZHUbGTCj6PDxvYX75oD5MiwRP';
const CORS_PROXIES = [ 'https://wandering-mode-2cec.nikitinsv.workers.dev/?url=' ];

const START_COMMANDS = [1037, 20532, 601];
const STOP_COMMANDS = [1042, 602];

// ===== DOM =====
const form = document.getElementById('loginForm');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const submitBtn = document.getElementById('submitBtn');
const captchaBlock = document.getElementById('captchaBlock');
const captchaImg = document.getElementById('captchaImg');
const captchaCodeInput = document.getElementById('captchaCode');

let pendingLoginData = null;
let currentCaptchaSid = null;

const dateInput = document.getElementById('dateFrom');
const monthAgo = new Date();
monthAgo.setMonth(monthAgo.getMonth() - 1);
dateInput.value = monthAgo.toISOString().split('T')[0];

window.addEventListener('load', () => {
    const saved = localStorage.getItem('starline_creds');
    if (saved) {
        try {
            const creds = JSON.parse(saved);
            document.getElementById('login').value = creds.login || '';
            document.getElementById('dateFrom').value = creds.dateFrom || dateInput.value;
            document.getElementById('useProxy').checked = creds.useProxy !== false;
        } catch (e) {}
    }
    
    // Принудительная активация нового Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(reg => reg.update());
        });
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const login = document.getElementById('login').value.trim();
    const password = document.getElementById('password').value;
    const dateFrom = new Date(document.getElementById('dateFrom').value);
    const useProxy = document.getElementById('useProxy').checked;

    localStorage.setItem('starline_creds', JSON.stringify({
        login, dateFrom: document.getElementById('dateFrom').value, useProxy
    }));

    submitBtn.disabled = true;
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    resultsEl.classList.add('hidden');
    captchaBlock.classList.add('hidden');

    try {
        alert('🔍 Шаг 1: начинаем авторизацию');
        const events = await fetchEvents(login, password, dateFrom, useProxy);
        alert('🔍 Шаг 2: получено событий: ' + (events?.length || 0));
        const result = calculateEngineHours(events);
        alert('🔍 Шаг 3: подсчёт завершён, моточасов: ' + (result.totalMs / 3600000).toFixed(2));
        displayResults(result);
    } catch (err) {
        alert('❌ ОШИБКА: ' + err.message + '\n\nСтек: ' + err.stack);
        showError(err.message);
    } finally {
        submitBtn.disabled = false;
        loadingEl.classList.add('hidden');
    }
});

document.getElementById('submitCaptcha').addEventListener('click', async () => {
    const code = captchaCodeInput.value.trim();
    if (!code) { showError('Введите код'); return; }
    if (!pendingLoginData) { showError('Начните заново'); return; }

    captchaBlock.classList.add('hidden');
    loadingEl.classList.remove('hidden');

    try {
        const events = await fetchEvents(
            pendingLoginData.login, pendingLoginData.password, 
            pendingLoginData.dateFrom, pendingLoginData.useProxy,
            currentCaptchaSid, code
        );
        displayResults(calculateEngineHours(events));
    } catch (err) {
        showError(err.message);
    } finally {
        loadingEl.classList.add('hidden');
    }
});

document.getElementById('refreshCaptcha').addEventListener('click', async () => {
    if (!pendingLoginData) return;
    try {
        const res = await fetchWithProxy(`${STARLINE_ID_URL}/captcha`, {}, pendingLoginData.useProxy);
        const data = await res.json();
        if (data.state === 1) {
            currentCaptchaSid = data.desc.captchaSid;
            captchaImg.src = data.desc.captchaImg;
        }
    } catch (e) {}
});

// ===== SHA-1 =====
async function sha1(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== MD5 =====
function md5(string) {
    function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q, a, b, x, s, t) { return add32(add32(a, q), add32(x, t)); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s) {
        var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= s.length; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
        tail[14] = n * 8; md5cycle(state, tail); return state;
    }
    function md5blk(s) {
        var m = [], i;
        for (i = 0; i < 64; i += 4) m[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        return m;
    }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    function hex(arr) {
        var h = '0123456789abcdef', r = '';
        for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) r += h.charAt((arr[j] >> (i * 8 + 4)) & 0x0F) + h.charAt((arr[j] >> (i * 8)) & 0x0F);
        return r;
    }
    return hex(md51(string));
}

// ===== СЕТЬ =====
async function fetchWithProxy(url, options = {}, useProxy = true) {
    if (!useProxy) {
        const res = await fetch(url, { ...options, credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    }
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        try {
            const proxyUrl = CORS_PROXIES[i] + encodeURIComponent(url);
            const res = await fetch(proxyUrl, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        } catch (e) { continue; }
    }
    throw new Error('Все CORS-прокси недоступны');
}

// ===== АВТОРИЗАЦИЯ =====
async function fetchEvents(login, password, dateFrom, useProxy, captchaSid = null, captchaCode = null) {
    try {
        alert('🔍 1/6: getCode');
        const secretMd5 = md5(APP_SECRET);
        const codeRes = await fetchWithProxy(`${STARLINE_ID_URL}/application/getCode?appId=${APP_ID}&secret=${secretMd5}`, {}, useProxy);
        const codeData = await codeRes.json();
        if (codeData.state !== 1) throw new Error('getCode: ' + JSON.stringify(codeData));
        const appCode = codeData.desc.code;

        alert('🔍 2/6: getToken');
        const secretCodeMd5 = md5(APP_SECRET + appCode);
        const tokenRes = await fetchWithProxy(`${STARLINE_ID_URL}/application/getToken?appId=${APP_ID}&secret=${secretCodeMd5}`, {}, useProxy);
        const tokenData = await tokenRes.json();
        if (tokenData.state !== 1) throw new Error('getToken: ' + JSON.stringify(tokenData));
        const appToken = tokenData.desc.token;

        alert('🔍 3/6: user/login');
        const passwordSha1 = await sha1(password);
        let body = `login=${encodeURIComponent(login)}&pass=${passwordSha1}`;
        if (captchaSid && captchaCode) body += `&captchaSid=${encodeURIComponent(captchaSid)}&captchaCode=${encodeURIComponent(captchaCode)}`;

        const userLoginRes = await fetchWithProxy(`${STARLINE_ID_URL}/user/login?token=${appToken}`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
        }, useProxy);
        const userLoginData = await userLoginRes.json();

        if (userLoginData.state === 0 && userLoginData.desc?.message?.includes('Captcha')) {
            pendingLoginData = { login, password, dateFrom, useProxy };
            currentCaptchaSid = userLoginData.desc.captchaSid;
            captchaImg.src = userLoginData.desc.captchaImg;
            captchaCodeInput.value = '';
            captchaBlock.classList.remove('hidden');
            throw new Error('CAPTCHA_REQUIRED');
        }
        if (userLoginData.state !== 1) throw new Error('login: ' + JSON.stringify(userLoginData));
        const userToken = userLoginData.desc.user_token;

        alert('🔍 4/6: auth.slid');
        const slnetRes = await fetchWithProxy(`${STARLINE_API_URL}/json/v2/auth.slid`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slid_token: userToken })
        }, useProxy);
        const slnetData = await slnetRes.json();
        if (slnetData.code != 200) throw new Error('auth.slid: ' + JSON.stringify(slnetData));

        const setCookie = slnetRes.headers.get('X-Set-Cookie');
        let slnetToken = slnetData.slnet;
        if (!slnetToken && setCookie) {
            const m = setCookie.match(/slnet=([^;]+)/);
            if (m) slnetToken = m[1];
        }
        const userId = slnetData.user_id;
        if (!userId || !slnetToken) throw new Error('Нет user_id или slnet');

        alert('🔍 5/6: user_info (userId=' + userId + ')');
        const devicesRes = await fetchWithProxy(`${STARLINE_API_URL}/json/v2/user/${userId}/user_info`, {
            headers: { 'X-Cookie': `slnet=${slnetToken}`, 'Content-Type': 'application/json' }
        }, useProxy);
        const devicesData = await devicesRes.json();
        if (devicesData.code != 200) throw new Error('user_info: ' + JSON.stringify(devicesData));
        const deviceId = devicesData.devices?.[0]?.device_id;
        if (!deviceId) throw new Error('Нет устройств');

        alert('🔍 6/6: events (deviceId=' + deviceId + ')');
        const startTime = Math.floor(dateFrom.getTime() / 1000);
        const endTime = Math.floor(Date.now() / 1000);
        const eventsRes = await fetchWithProxy(`${STARLINE_API_URL}/json/v2/device/${deviceId}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Cookie': `slnet=${slnetToken}` },
            body: JSON.stringify({ from: startTime, to: endTime })
        }, useProxy);
        const eventsData = await eventsRes.json();

        window.debugInfo = {
            deviceId, userId,
            totalEvents: eventsData.events?.length || 0,
            firstEvents: eventsData.events?.slice(0, 5) || [],
            raw: eventsData
        };
        
        return eventsData.events || [];
    } catch (err) {
        if (err.message === 'CAPTCHA_REQUIRED') throw err;
        throw new Error('fetchEvents: ' + err.message);
    }
}

// ===== ПОДСЧЁТ =====
function calculateEngineHours(rawEvents) {
    if (!rawEvents || rawEvents.length < 2) return { totalMs: 0, sessions: [], byDay: [] };

    const allEvents = rawEvents
        .map(e => ({ eventId: e.event_id || e.type, time: new Date((e.ts || e.time) * 1000) }))
        .filter(e => START_COMMANDS.includes(e.eventId) || STOP_COMMANDS.includes(e.eventId))
        .sort((a, b) => a.time - b.time);

    if (allEvents.length < 2) return { totalMs: 0, sessions: [], byDay: [] };
    if (STOP_COMMANDS.includes(allEvents[0].eventId)) allEvents.shift();

    const sessions = [];
    let totalMs = 0;
    for (let i = 0; i < allEvents.length - 1; i += 2) {
        if (STOP_COMMANDS.includes(allEvents[i].eventId)) { i--; continue; }
        const start = allEvents[i].time;
        const end = allEvents[i + 1].time;
        const duration = end - start;
        if (duration > 0 && duration < 24 * 60 * 60 * 1000) {
            sessions.push({ start, end, duration });
            totalMs += duration;
        }
    }

    const byDayMap = {};
    for (const s of sessions) {
        const key = s.start.toISOString().split('T')[0];
        if (!byDayMap[key]) byDayMap[key] = [];
        byDayMap[key].push(s);
    }

    const byDay = Object.entries(byDayMap)
        .map(([date, daySessions]) => ({
            date: new Date(date), sessions: daySessions,
            totalMs: daySessions.reduce((sum, s) => sum + s.duration, 0)
        }))
        .sort((a, b) => b.date - a.date);

    return { totalMs, sessions, byDay };
}

// ===== ОТОБРАЖЕНИЕ =====
function displayResults(result) {
    const h = Math.floor(result.totalMs / (1000 * 60 * 60));
    const m = Math.floor((result.totalMs % (1000 * 60 * 60)) / (1000 * 60));

    document.getElementById('totalHours').textContent = h;
    document.getElementById('totalMinutes').textContent = `${m} минут`;
    document.getElementById('daysCount').textContent = result.byDay.length;
    document.getElementById('startsCount').textContent = result.sessions.length;

    const dailyEl = document.getElementById('dailyResults');
    dailyEl.innerHTML = '';

    if (window.debugInfo) {
        const debugCard = document.createElement('div');
        debugCard.className = 'day-card';
        debugCard.style.cssText = 'background:#fff3cd;border-left:4px solid #ffc107;margin-bottom:16px;';
        debugCard.innerHTML = `
            <div class="day-header"><div class="day-date">🔍 Отладка</div><div class="day-hours">${window.debugInfo.totalEvents} событий</div></div>
            <div style="font-size:12px;color:#555;margin-top:8px;">
                <div><b>Device:</b> ${window.debugInfo.deviceId}</div>
                <div style="margin-top:6px;"><b>Первые события:</b></div>
                <pre style="background:#fff;padding:8px;border-radius:4px;overflow-x:auto;font-size:10px;margin-top:4px;max-height:200px;">${JSON.stringify(window.debugInfo.firstEvents, null, 2)}</pre>
            </div>`;
        dailyEl.appendChild(debugCard);
    }

    if (result.byDay.length === 0) {
        const noData = document.createElement('p');
        noData.style.cssText = 'text-align:center;color:#888;padding:20px;';
        noData.textContent = 'Событий запуска/остановки не найдено. Проверь жёлтый блок выше.';
        dailyEl.appendChild(noData);
    } else {
        for (const day of result.byDay) {
            const dh = Math.floor(day.totalMs / (1000 * 60 * 60));
            const dm = Math.floor((day.totalMs % (1000 * 60 * 60)) / (1000 * 60));
            const card = document.createElement('div');
            card.className = 'day-card';
            card.innerHTML = `
                <div class="day-header">
                    <div class="day-date">${formatDate(day.date)}</div>
                    <div class="day-hours">${dh}ч ${dm}м</div>
                </div>
                ${day.sessions.map(s => `
                    <div class="session">
                        <span>${formatTime(s.start)} → ${formatTime(s.end)}</span>
                        <span class="session-duration">${formatDuration(s.duration)}</span>
                    </div>`).join('')}`;
            dailyEl.appendChild(card);
        }
    }
    resultsEl.classList.remove('hidden');
}

function formatDate(d) { return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'long', year:'numeric', weekday:'short' }); }
function formatTime(d) { return d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }
function formatDuration(ms) {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}ч ${m}м`;
}
function showError(msg) {
    if (msg === 'CAPTCHA_REQUIRED') return;
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}
