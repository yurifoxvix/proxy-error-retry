// Proxy Error Auto-Swipe
// Detects "proxy error" in streamed/finished responses, stops generation,
// and swipes until a clean response comes back.

const MODULE = 'proxy_error_retry';
const DEFAULTS = Object.freeze({
    enabled: true,
    pattern: 'proxy error',   // case-insensitive substring (or regex if useRegex)
    useRegex: false,
    maxRetries: 10,
    delayMs: 1000,            // wait before each swipe
});

let retries = 0;
let handling = false;

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE]) extensionSettings[MODULE] = structuredClone(DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(extensionSettings[MODULE], k)) extensionSettings[MODULE][k] = DEFAULTS[k];
    }
    return extensionSettings[MODULE];
}

function matches(text) {
    if (!text) return false;
    const s = getSettings();
    try {
        if (s.useRegex) return new RegExp(s.pattern, 'i').test(text);
    } catch (e) {
        console.warn(`[${MODULE}] invalid regex`, e);
        return false;
    }
    return text.toLowerCase().includes(s.pattern.toLowerCase());
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ST shows #mes_stop while a generation is active.
async function waitForIdle(timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (!$('#mes_stop').is(':visible')) return true;
        await sleep(100);
    }
    return false;
}

async function swipeAgain() {
    const s = getSettings();
    if (handling) return;
    handling = true;
    try {
        if (retries >= s.maxRetries) {
            toastr.error(`Still getting "${s.pattern}" after ${retries} retries. Giving up.`, 'Proxy Error Auto-Swipe');
            retries = 0;
            return;
        }
        retries++;
        await waitForIdle();
        await sleep(s.delayMs);
        const btn = $('#chat .last_mes .swipe_right:visible').last();
        if (!btn.length) {
            console.warn(`[${MODULE}] swipe button not found`);
            return;
        }
        toastr.warning(`Retry ${retries}/${s.maxRetries}`, 'Proxy Error Auto-Swipe');
        btn.trigger('click');
    } finally {
        handling = false;
    }
}

function onStreamToken(text) {
    const s = getSettings();
    if (!s.enabled || handling) return;
    // payload is the accumulated text so far
    const str = typeof text === 'string' ? text : (text?.text ?? '');
    if (matches(str)) {
        handling = false; // swipeAgain sets it
        const { stopGeneration } = SillyTavern.getContext();
        stopGeneration();
        swipeAgain();
    }
}

// Fallback for non-streaming responses, or errors that arrive as the final message.
function onMessageRendered(messageId) {
    const s = getSettings();
    if (!s.enabled) return;
    const { chat } = SillyTavern.getContext();
    const msg = chat[messageId];
    if (!msg || msg.is_user || msg.is_system) return;
    if (matches(msg.mes)) {
        swipeAgain();
    } else {
        retries = 0; // clean response, reset counter
    }
}

function addSettingsUI() {
    const s = getSettings();
    const { saveSettingsDebounced } = SillyTavern.getContext();
    const html = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Proxy Error Auto-Swipe</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label class="checkbox_label"><input type="checkbox" id="pers_enabled"><span>Enabled</span></label>
            <label>Match text <input type="text" id="pers_pattern" class="text_pole"></label>
            <label class="checkbox_label"><input type="checkbox" id="pers_regex"><span>Treat as regex</span></label>
            <label>Max retries <input type="number" id="pers_max" class="text_pole" min="1" max="100"></label>
            <label>Delay before swipe (ms) <input type="number" id="pers_delay" class="text_pole" min="0" step="100"></label>
        </div>
    </div>`;
    $('#extensions_settings2').append(html);

    $('#pers_enabled').prop('checked', s.enabled).on('change', e => { s.enabled = e.target.checked; saveSettingsDebounced(); });
    $('#pers_pattern').val(s.pattern).on('input', e => { s.pattern = e.target.value; saveSettingsDebounced(); });
    $('#pers_regex').prop('checked', s.useRegex).on('change', e => { s.useRegex = e.target.checked; saveSettingsDebounced(); });
    $('#pers_max').val(s.maxRetries).on('input', e => { s.maxRetries = Number(e.target.value) || 1; saveSettingsDebounced(); });
    $('#pers_delay').val(s.delayMs).on('input', e => { s.delayMs = Number(e.target.value) || 0; saveSettingsDebounced(); });
}

jQuery(() => {
    const { eventSource, event_types } = SillyTavern.getContext();
    addSettingsUI();
    eventSource.on(event_types.STREAM_TOKEN_RECEIVED, onStreamToken);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    console.log(`[${MODULE}] loaded`);
});
