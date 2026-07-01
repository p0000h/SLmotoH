alert('🔢 Версия скрипта: 28');
// ===== КОНФИГУРАЦИЯ =====
const STARLINE_ID_URL = 'https://id.starline.ru/apiV3';
const STARLINE_API_URL = 'https://developer.starline.ru';

const APP_ID = '50254'; 
const APP_SECRET = 'JfZ5bOVZHUbGTCj6PDxvYX75oD5MiwRP';
const CORS_PROXIES = [ 'https://wandering-mode-2cec.nikitinsv.workers.dev/?url=' ];

const START_COMMANDS = [1037, 20532, 601];
const STOP_COMMANDS = [1042, 602];

// ===== ДИАГНОСТИКА: проверяем загрузку =====
alert('✅ Скрипт загружен!');

// ===== Безопасная функция для поиска элементов =====
function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('Элемент не найден: ' + id);
    return el;
}

// ===== DOM =====
const form = $('loginForm');
const loadingEl = $('loading');
const errorEl = $('error');
const resultsEl = $('results');
const submitBtn = $('submitBtn');
const captchaBlock = $('captchaBlock');
const captchaImg = $('captchaImg');
const captchaCodeInput = $('captchaCode');
const refreshCaptchaBtn = $('refreshCaptcha');
const submitCaptchaBtn = $('submitCaptcha');
const dateInput = $('dateFrom');

let pendingLoginData = null;
let currentCaptchaSid = null;

// Дата по умолчанию — месяц назад
if (dateInput) {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateInput.value = monthAgo.toISOString().split('T')[0];
}

// Восстановление данных
window.addEventListener('load', () => {
    try {
        const saved = localStorage.getItem('starline_creds');
        if (saved) {
            const creds = JSON.parse(saved);
            if ($('login')) $('login').value = creds.login || '';
            if ($('dateFrom')) $('dateFrom').value = creds.dateFrom || dateInput.value;
            if ($('useProxy')) $('useProxy').checked = creds.useProxy !== false;
        }
    } catch (e) { console.error(e); }
});

// ===== ОБРАБОТЧИК ФОРМЫ =====
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        alert('🚀 Форма отправлена! Начинаем...');
        
        const login = $('login').value.trim();
        const password = $('password').value;
        const dateFrom = new Date($('dateFrom').value);
        const useProxy = $('useProxy').checked;

        localStorage.setItem('starline_creds', JSON.stringify({
            login, dateFrom: $('dateFrom').value, useProxy
        }));

        submitBtn.disabled = true;
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        resultsEl.classList.add('hidden');
        if (captchaBlock) captchaBlock.classList.add('hidden');

        try {
            const events = await fetchEvents(login, password, dateFrom, useProxy);
            const result = calculateEngineHours(events);
            displayResults(result);
        } catch (err) {
            if (err.message !== 'CAPTCHA_REQUIRED') {
                alert('❌ ОШИБКА: ' + err.message);
                showError(err.message);
            }
        } finally {
            submitBtn.disabled = false;
            loadingEl.classList.add('hidden');
        }
    });
} else {
    alert('❌ Форма не найдена!');
}

// ===== КАПЧА =====
if (submitCaptchaBtn) {
    submitCaptchaBtn.addEventListener('click', async () => {
        const code = captchaCodeInput.value.trim();
        if (!code) { showError('Введите код'); return; }
        if (!pendingLoginData) { showError('Начните заново'); return; }

        if (captchaBlock) captchaBlock.classList.add('hidden');
        loadingEl.classList.remove('hidden');

        try {
            const events = await fetchEvents(
                pendingLoginData.login, pendingLoginData.password, 
                pendingLoginData.dateFrom, pendingLoginData.useProxy,
                currentCaptchaSid, code
            );
            displayResults(calculateEngineHours(events));
        } catch (err) {
            if (err.message !== 'CAPTCHA_REQUIRED') showError(err.message);
        } finally {
            loadingEl.classList.add('hidden');
        }
    });
}

if (refreshCaptchaBtn) {
    refreshCaptchaBtn.addEventListener('click', async () => {
        if (!pendingLoginData) return;
        try {
            const res = await fetchWithProxy(`${STARLINE_ID_URL}/captcha`, {}, pendingLoginData.useProxy);
            const data = await res.json();
            if (data.state === 1 && captchaImg) {
                currentCaptchaSid = data.desc.captchaSid;
                captchaImg.src = data.desc.captchaImg;
            }
        } catch (e) {}
    });
}

// ===== SHA-1 =====
async function sha1(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== MD5 =====
// ===== MD5 (проверенная реализация) =====
function md5(string) {
    function RotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function AddUnsigned(lX, lY) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        if (lX4 | lY4) {
            if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function ConvertToWordArray(string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWords_temp1 = lMessageLength + 8;
        var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        var lWordArray = Array(lNumberOfWords - 1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function WordToHex(lValue) {
        var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    function Utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }
    var x = Array();
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9,  S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = Utf8Encode(string);
    x = ConvertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k+0],  S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k+1],  S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k+2],  S13, 0x242070DB);
        b = FF(b, c, d, a, x[k+3],  S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k+4],  S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k+5],  S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k+6],  S13, 0xA8304613);
        b = FF(b, c, d, a, x[k+7],  S14, 0xFD469501);
        a = FF(a, b, c, d, x[k+8],  S11, 0x698098D8);
        d = FF(d, a, b, c, x[k+9],  S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k+10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k+11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k+12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k+13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k+14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k+15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k+1],  S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k+6],  S22, 0xC040B340);
        c = GG(c, d, a, b, x[k+11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k+0],  S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k+5],  S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k+10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k+15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k+4],  S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k+9],  S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k+14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k+3],  S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k+8],  S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k+13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k+2],  S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k+7],  S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k+12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k+5],  S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k+8],  S32, 0x8771F681);
        c = HH(c, d, a, b, x[k+11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k+14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k+1],  S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k+4],  S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k+7],  S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k+10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k+13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k+0],  S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k+3],  S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k+6],  S34, 0x4881D05);
        a = HH(a, b, c, d, x[k+9],  S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k+12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k+15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k+2],  S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k+0],  S41, 0xF4292244);
        d = II(d, a, b, c, x[k+7],  S42, 0x432AFF97);
        c = II(c, d, a, b, x[k+14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k+5],  S44, 0xFC93A039);
        a = II(a, b, c, d, x[k+12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k+3],  S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k+10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k+1],  S44, 0x85845DD1);
        a = II(a, b, c, d, x[k+8],  S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k+15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k+6],  S43, 0xA3014314);
        b = II(b, c, d, a, x[k+13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k+4],  S41, 0xF7537E82);
        d = II(d, a, b, c, x[k+11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k+2],  S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k+9],  S44, 0xEB86D391);
        a = AddUnsigned(a, AA);
        b = AddUnsigned(b, BB);
        c = AddUnsigned(c, CC);
        d = AddUnsigned(d, DD);
    }
    var temp = WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d);
    return temp.toLowerCase();
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
    // ===== ДИАГНОСТИКА =====
    const secretMd5 = md5(APP_SECRET);
    
    // Проверка MD5 на известной строке
    const testMd5 = md5('test');
    const expectedTestMd5 = '098f6bcd4621d373cade4e832627b4f6'; // MD5 от 'test'
    
    alert(
        '🔍 ДИАГНОСТИКА\n\n' +
        'APP_ID: ' + APP_ID + '\n' +
        'APP_SECRET: ' + APP_SECRET.substring(0, 10) + '... (длина: ' + APP_SECRET.length + ')\n' +
        'MD5 от SECRET: ' + secretMd5 + '\n\n' +
        'Проверка MD5:\n' +
        'MD5("test") = ' + testMd5 + '\n' +
        'Ожидалось:   ' + expectedTestMd5 + '\n' +
        'Совпадает: ' + (testMd5 === expectedTestMd5 ? '✅ ДА' : '❌ НЕТ')
    );
    
    if (testMd5 !== expectedTestMd5) {
        throw new Error('MD5 работает неправильно! Тест не прошёл.');
    }
    // ===== КОНЕЦ ДИАГНОСТИКИ =====
    
    alert('🔍 1/6: getCode');
    const codeRes = await fetchWithProxy(`${STARLINE_ID_URL}/application/getCode?appId=${APP_ID}&secret=${secretMd5}`, {}, useProxy);
    const codeData = await codeRes.json();
    
    alert('Ответ getCode:\n' + JSON.stringify(codeData, null, 2));
    
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
// ===== ДИАГНОСТИКА user/login =====
alert(
    '🔍 Ответ user/login:\n\n' + 
    'State: ' + userLoginData.state + '\n' +
    'Message: ' + (userLoginData.desc?.message || 'нет') + '\n\n' +
    'Полный ответ:\n' + JSON.stringify(userLoginData, null, 2)
);
// ===== КОНЕЦ ДИАГНОСТИКИ =====

    if (userLoginData.state === 0 && userLoginData.desc?.message?.includes('Captcha')) {
        pendingLoginData = { login, password, dateFrom, useProxy };
        currentCaptchaSid = userLoginData.desc.captchaSid;
        if (captchaImg) captchaImg.src = userLoginData.desc.captchaImg;
        if (captchaCodeInput) captchaCodeInput.value = '';
        if (captchaBlock) captchaBlock.classList.remove('hidden');
        throw new Error('CAPTCHA_REQUIRED');
    }
    if (userLoginData.state !== 1) throw new Error('login: ' + JSON.stringify(userLoginData));
    const userToken = userLoginData.desc.user_token;

alert('🔍 4/6: auth.slid');
alert('Отправляем slid_token: ' + userToken.substring(0, 20) + '...');

// Добавляем таймаут 10 секунд
const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Таймаут 10 секунд')), 10000)
);

const authPromise = fetchWithProxy(`${STARLINE_API_URL}/json/v2/auth.slid`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slid_token: userToken })
}, useProxy);

const slnetRes = await Promise.race([authPromise, timeoutPromise]);
const slnetData = await slnetRes.json();

alert(
    '🔍 Ответ auth.slid:\n\n' +
    'Code: ' + slnetData.code + '\n' +
    'User ID: ' + (slnetData.user_id || 'нет') + '\n' +
    'SLNET: ' + (slnetData.slnet ? 'получен' : 'НЕТ') + '\n' +
    'X-Set-Cookie: ' + (slnetRes.headers.get('X-Set-Cookie') ? 'есть' : 'НЕТ') + '\n\n' +
    'Полный ответ:\n' + JSON.stringify(slnetData, null, 2)
);

if (slnetData.code != 200) throw new Error('auth.slid: ' + JSON.stringify(slnetData));

const setCookie = slnetRes.headers.get('X-Set-Cookie');
let slnetToken = slnetData.slnet;
if (!slnetToken && setCookie) {
    const m = setCookie.match(/slnet=([^;]+)/);
    if (m) slnetToken = m[1];
}
const userId = slnetData.user_id;
if (!userId || !slnetToken) throw new Error('Нет user_id или slnet');

    alert('🔍 5/6: user_info');
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
alert('Период: ' + new Date(startTime * 1000).toLocaleDateString('ru-RU') + ' — ' + new Date(endTime * 1000).toLocaleDateString('ru-RU'));

// GET-запрос с параметрами в URL
const eventsUrl = `${STARLINE_API_URL}/json/v2/device/${deviceId}/events?start=${startTime}&end=${endTime}&limit=1000`;
alert('URL: ' + eventsUrl);

const eventsRes = await fetchWithProxy(eventsUrl, {
    method: 'GET',
    headers: { 
        'X-Cookie': `slnet=${slnetToken}`,
        'Content-Type': 'application/json'
    }
}, useProxy);
const eventsData = await eventsRes.json();

alert(
    '🔍 Ответ events:\n\n' +
    'Код: ' + eventsData.code + '\n' +
    'Всего событий: ' + (eventsData.events?.length || 0) + '\n\n' +
    'Первые 10:\n' + 
    JSON.stringify(eventsData.events?.slice(0, 10) || eventsData.answer?.events?.slice(0, 10) || [], null, 2).substring(0, 1500)
);

window.debugInfo = {
    deviceId, userId,
    totalEvents: eventsData.events?.length || 0,
    firstEvents: eventsData.events?.slice(0, 10) || [],
    raw: eventsData
};

return eventsData.events || eventsData.answer?.events || [];
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

    $('totalHours').textContent = h;
    $('totalMinutes').textContent = `${m} минут`;
    $('daysCount').textContent = result.byDay.length;
    $('startsCount').textContent = result.sessions.length;

    const dailyEl = $('dailyResults');
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
        noData.textContent = 'Событий запуска/остановки не найдено.';
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
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
}
