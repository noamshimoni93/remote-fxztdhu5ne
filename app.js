/* Phone remote for TV Home.
   Talks to the TV through the free ntfy.sh relay: commands go to the topic "<key>-tv", the TV's
   state comes back on "<key>-phone". The key is in the personal link (#k=...), never in this page,
   so the page alone can't reach any TV. Names, apps and settings all come from the TV. */
(function () {
  'use strict';

  var RELAY = 'https://ntfy.sh/';
  var PING_WAIT = 7000;     // ms to wait for the TV to answer before calling it off or asleep
  var TURN_ON_WAIT = 25000; // ms the status says "Turning on…" after the power tap, unless the TV answers

  // ---------------------------------------------------------------- text
  var TEXT = {
    checking: 'Checking…', tvOn: 'TV is on', tvOnClosed: 'TV is on, TV Home closed', turningOn: 'Turning on…',
    tvOff: 'TV is off or asleep', macAsleep: 'Mac is asleep', noRelay: 'Can’t reach the relay',
    statusLabel: 'TV status: {what}. Tap for details.',
    showing: 'Showing: {what}', homeScreen: 'TV Home', otherApp: 'another app', homeClosed: 'TV Home isn’t open',
    lastSeen: 'Last seen {when}', neverSeen: 'Not heard from yet', justNow: 'just now', minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago', weather: 'Tel Aviv {w}', checkNet: 'Sending failed: check the internet',
    macOn: 'Mac connected: volume, keys and power work', macOff: 'Mac asleep or off: volume, keys and power won’t work',
    appsHidden: '{n} apps · tap to show them', appsShown: 'Tap one to open it on the TV',
    play: 'Play', pause: 'Pause', powerOn: 'Turn the TV on', powerOff: 'Turn the TV off',
    turningOnToast: 'Turning the TV on…', turningOff: 'Turning the TV off…', stillOff: 'The TV hasn’t come on yet',
    sent: 'Sent', opening: 'Opening {app}', failed: 'Couldn’t reach the relay', saved: 'Saved',
    wallSet: 'Wallpaper changed', drawFirst: 'Draw something first',
    quick1: 'Dinner’s ready', quick2: 'On my way home', quick3: 'Movie night?', quick4: 'Love you',
    up: 'Move up', down: 'Move down', show: 'Show in the dock',
    coast: 'Tel Aviv coast', dusk: 'Dusk ridges', sea: 'Blue-hour sea', aurora: 'Aurora lake', custom: 'Your photo',
    uploading: 'Sending the photo…', uploadHint: 'Cropped to the TV’s shape and sent to the TV.',
    tooBig: 'That photo is too big to send',
    lookAuto: 'Follows the sun in Tel Aviv: light from {rise}, dark from {set}.',
    lookAutoPlain: 'Follows the sun in Tel Aviv: light from sunrise, dark from sunset.',
    lookLight: 'Stays light day and night, until you switch back to Auto.',
    lookDark: 'Stays dark day and night, until you switch back to Auto.',
    lookSet: 'TV Home switched to {look}', lookAutoSet: 'TV Home follows the sun again', light: 'light', dark: 'dark',
    brush: 'Brush size: {size}', thin: 'thin', medium: 'medium', thick: 'thick',
    white: 'White', teal: 'Teal', coral: 'Coral', yellow: 'Yellow', blue: 'Blue'
  };

  function t(key, vars) {
    return (TEXT[key] || key).replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; });
  }

  function $(id) {
    return document.getElementById(id);
  }

  // ---------------------------------------------------------------- key and storage
  var hashKey = (location.hash.match(/k=([A-Za-z0-9]{20,64})/) || [])[1];
  var key = hashKey;
  try {
    if (hashKey) localStorage.setItem('tvremote.key', hashKey);
    else key = localStorage.getItem('tvremote.key');
  } catch (e) { /* storage unavailable */ }

  function saved(name, fallback) {
    try { var v = JSON.parse(localStorage.getItem('tvremote.' + name)); return v === null ? fallback : v; } catch (e) { return fallback; }
  }

  function save(name, value) {
    try { localStorage.setItem('tvremote.' + name, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- relay
  var state = saved('state', null); // the TV's last reported state
  var me = saved('me', null);       // who is holding this phone (a name from the TV)
  var pingAt = 0;
  var pingTimer;
  var relayOk = true;               // false since the last send that couldn't reach the relay

  // `from`: the control(s) tapped; they light up with a tick once the relay has the command, or
  // shake when it couldn't be sent
  function send(command, from) {
    command.v = 1;
    if (me) command.from = me;
    return relayDone(fetch(RELAY + key + '-tv', { method: 'POST', body: JSON.stringify(command) }), from);
  }

  // A picture (a photo or a drawing) goes as an attachment; the command rides in the Message header,
  // which must be plain ASCII, so other characters are written as JSON \u escapes.
  function sendFile(blob, filename, command, from) {
    command.v = 1;
    if (me) command.from = me;
    var header = JSON.stringify(command).replace(/[\u0080-￿]/g, function (c) {
      return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
    return relayDone(fetch(RELAY + key + '-tv', { method: 'PUT', body: blob, headers: { 'Filename': filename, 'Message': header } }), from);
  }

  function relayDone(request, from) {
    return request.then(function (r) {
      if (!r.ok) throw new Error(r.status);
      if (!relayOk) { relayOk = true; renderStatus(); }
      mark(from, 'sent');
    }).catch(function () {
      relayOk = false;
      renderStatus();
      mark(from, 'unsent');
      toast(t('failed'));
      throw new Error('relay');
    });
  }

  function mark(from, how) {
    [].concat(from || []).forEach(function (b) {
      b.classList.remove('sent', 'unsent');
      void b.offsetWidth; // restart the animation on a repeat tap
      b.classList.add(how);
      clearTimeout(b.markTimer);
      b.markTimer = setTimeout(function () { b.classList.remove(how); }, 1100);
    });
  }

  function ping() {
    pingAt = Date.now();
    statusMode = 'wait';
    renderStatus();
    clearTimeout(pingTimer);
    pingTimer = setTimeout(function () {
      macMissed = relayOk && macAt < pingAt; // when the relay itself failed, the Mac never got the ping
      statusMode = state && state.at >= pingAt - 2000 ? 'on' : 'off';
      renderAll();
    }, PING_WAIT);
    send({ cmd: 'ping' }).catch(function () { statusMode = 'off'; renderStatus(); });
  }

  function takeState(message) {
    var s;
    try { s = JSON.parse(message); } catch (e) { return; }
    if (!s || s.v !== 1 || s.kind !== 'state') return;
    if (state && s.at < state.at) return;
    state = s;
    save('state', s);
    relayOk = true; // it came through the relay, so the relay is reachable
    statusMode = 'on';
    turningOnUntil = 0;
    renderAll();
  }

  // A live relay subscription that backs off when refused: the browser's own retry every few seconds
  // keeps a whole home over ntfy.sh's limit (about one request every 5 s).
  function subscribe(url, onMessage) {
    var wait = 5000;
    (function open() {
      var openedAt = Date.now();
      var source = new EventSource(url);
      source.onmessage = onMessage;
      source.onerror = function () {
        source.close();
        // a connection the relay dropped quickly doesn't count as working: keep backing off
        if (Date.now() - openedAt > 60000) wait = 5000;
        setTimeout(open, wait);
        wait = Math.min(wait * 2, 120000);
      };
    })();
  }

  function listen() {
    // the last state the TV sent (up to 12 hours back), then live updates
    fetch(RELAY + key + '-phone/json?poll=1&since=12h').then(function (r) { return r.text(); }).then(function (text) {
      text.trim().split('\n').forEach(function (line) {
        try { var e = JSON.parse(line); if (e.event === 'message') takeState(e.message); } catch (x) { /* skip */ }
      });
    }).catch(function () {}).then(ping);
    // TV Home's state, and the Mac helper's answers to pings (they carry the TV's power)
    subscribe(RELAY + key + '-phone,' + key + '-tv/sse', function (m) {
      try {
        var e = JSON.parse(m.data);
        if (e.event !== 'message') return;
        if (/-phone$/.test(e.topic)) return takeState(e.message);
        var a = JSON.parse(e.message);
        if (a && a.kind === 'ack') takeAck(a);
      } catch (x) { /* skip */ }
    });
  }

  // ---------------------------------------------------------------- status icon
  // One answer to "how is the TV?", for both the icon's dot and the details behind it.
  var statusMode = 'wait'; // 'wait' while a ping is out, then 'on' (TV Home answered) or 'off'
  var turningOnUntil = 0;

  function statusKind() {
    if (!relayOk) return 'noRelay';
    var homeAnswered = statusMode === 'on' && state && state.at >= pingAt - 2000;
    if (homeAnswered) return macOn() ? 'on' : 'macAsleep';
    if (Date.now() < turningOnUntil) return 'turningOn';
    if (statusMode === 'wait') return 'checking';
    if (macOn() && tvPower === 'on') return 'onClosed';
    return 'off';
  }

  // kind -> [dot style, text, how faint the TV glyph is]
  var STATUS = {
    checking: ['wait', 'checking', ''], on: ['on', 'tvOn', ''], onClosed: ['on', 'tvOnClosed', 'faint'],
    turningOn: ['wait', 'turningOn', 'faint'], off: ['', 'tvOff', 'fainter'], macAsleep: ['mac', 'macAsleep', ''],
    noRelay: ['err', 'noRelay', '']
  };

  function renderStatus() {
    var kind = statusKind();
    var s = STATUS[kind];
    $('status-dot').className = 'dot ' + s[0];
    $('card-dot').className = 'dot ' + s[0];
    var btn = $('status-btn');
    btn.classList.toggle('faint', s[2] === 'faint');
    btn.classList.toggle('fainter', s[2] === 'fainter');
    btn.setAttribute('aria-label', t('statusLabel', { what: t(s[1]) }));
    $('status-main').textContent = t(s[1]);
    var sub = '';
    if (kind === 'on' || kind === 'macAsleep') {
      var what = state.front === 'home' ? t('homeScreen') : state.front === 'other' ? t('otherApp') : state.front;
      sub = t('showing', { what: what }) + (state.weather ? ' · ' + t('weather', { w: state.weather }) : '');
    } else if (kind === 'onClosed') {
      sub = t('homeClosed');
    } else if (kind === 'off') {
      sub = state ? t('lastSeen', { when: ago(state.at) }) : t('neverSeen');
    } else if (kind === 'noRelay') {
      sub = t('checkNet');
    }
    $('status-sub').textContent = sub;
    $('status-mac').textContent = kind === 'noRelay' ? '' : macMissed ? t('macOff') : macAt ? t('macOn') : '';
  }

  function ago(at) {
    var min = Math.round((Date.now() - at) / 60000);
    if (min < 1) return t('justNow');
    if (min < 60) return t('minutesAgo', { n: min });
    return t('hoursAgo', { n: Math.round(min / 60) });
  }

  function showCard(open) {
    $('status-card').hidden = !open;
    $('status-btn').setAttribute('aria-expanded', String(open));
  }

  // ---------------------------------------------------------------- rendering
  function names() {
    return state && state.names ? state.names.split(/\s+&\s+/).filter(Boolean) : [];
  }

  function isLight(rgb) {
    var c = String(rgb).split(',').map(Number);
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] > 186;
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderAll() {
    $('brand').textContent = state && state.names ? state.names : 'TV';
    renderApps();
    renderMacNote();
    renderWho();
    renderDock();
    renderWalls();
    renderLook();
    renderPlay();
    renderStatus();
    renderPower();
    askWho();
  }

  // the same icons as the dock on the TV (TV Home's icons/), by app name; others get their initial
  var ICONS = {
    'PlayStation 5': 'ps5.svg', 'Netflix': 'netflix.svg', 'Apple TV': 'appletv.svg', 'Prime Video': 'prime.svg',
    'Disney+': 'disney.png', 'Partner TV+': 'partner.png', 'Stremio': 'stremio.png', 'YouTube': 'youtube.svg',
    'Spotify': 'spotify.svg'
  };
  var CONTAIN = { 'Stremio': true }; // a logo with its own margin, drawn smaller on a dark square like on the TV

  function appIcon(app, cls) {
    var tile = el('span', { 'class': cls + (isLight(app.rgb) ? ' light' : '') + (CONTAIN[app.label] ? ' contain' : ''), 'aria-hidden': 'true' });
    tile.style.setProperty('--rgb', app.rgb);
    if (ICONS[app.label]) {
      var img = el('img', { src: 'icons/' + ICONS[app.label], alt: '' });
      img.onerror = function () { tile.textContent = app.label.charAt(0); };
      tile.appendChild(img);
    } else {
      tile.textContent = app.label.charAt(0);
    }
    return tile;
  }

  // ---------------------------------------------------------------- apps (behind one button)
  // The grid is rebuilt only when the apps themselves change, so a state arriving mid-animation
  // doesn't cut the opening short.
  var appsOpen = false;
  var appsShape = '';
  var APPS_CLOSE_AFTER = 1100; // ms after an app tap was sent: time to see the tick

  function renderApps() {
    var apps = (state && state.apps) || [];
    $('apps-hint').textContent = appsOpen ? t('appsShown') : t('appsHidden', { n: apps.length });
    var shape = apps.map(function (a) { return a.label + (a.hidden ? '-' : '') + a.rgb; }).join('|');
    if (shape === appsShape) return;
    appsShape = shape;
    var mini = $('apps-mini');
    mini.innerHTML = '';
    apps.filter(function (a) { return !a.hidden; }).slice(0, 4).forEach(function (app) { mini.appendChild(appIcon(app, 'tile')); });
    var box = $('apps');
    box.innerHTML = '';
    apps.forEach(function (app, i) {
      var cell = el('div', { 'class': 'app-cell' });
      cell.style.setProperty('--i', i);
      var b = el('button', { type: 'button', 'class': 'app-btn' + (app.hidden ? ' off' : '') });
      var tile = appIcon(app, 'tile');
      b.appendChild(tile);
      b.appendChild(el('span', { 'class': 'name' }, app.label));
      b.addEventListener('click', function () {
        send({ cmd: 'open', app: app.label }, tile).then(function () {
          toast(t('opening', { app: app.label }));
          setTimeout(function () { setAppsOpen(false); }, APPS_CLOSE_AFTER);
        }).catch(function () {});
      });
      cell.appendChild(b);
      box.appendChild(cell);
    });
  }

  function setAppsOpen(open) {
    appsOpen = open;
    $('apps-toggle').setAttribute('aria-expanded', String(open));
    $('apps-box').classList.toggle('open', open);
    renderApps();
  }

  // ---------------------------------------------------------------- the Mac helper
  // It presses the TV's real keys; its answers to pings say it's there, and the TV's power. It counts
  // as asleep only once it has missed a ping, not because a while has passed since the last one.
  var macAt = 0, tvPower = null;
  var macMissed = false; // the helper didn't answer the latest ping
  function takeAck(a) {
    macAt = Date.now();
    macMissed = false;
    tvPower = a.tv || null;
    relayOk = true;
    if (tvPower === 'on') turningOnUntil = 0;
    renderAll();
  }

  function macOn() {
    return !macMissed;
  }

  function tvIsOn() {
    var kind = statusKind();
    return kind === 'on' || kind === 'onClosed' || kind === 'macAsleep';
  }

  function renderPower() {
    var b = $('power');
    var on = tvIsOn();
    b.classList.toggle('on', on);
    b.disabled = !macOn();
    b.setAttribute('aria-label', t(on ? 'powerOff' : 'powerOn'));
  }

  function renderMacNote() {
    $('pad-note').hidden = macOn();
  }

  // ---------------------------------------------------------------- remote keys
  // Keys go to the Mac helper, which presses them on the TV. Taps within a short moment travel as one
  // message: the free relay allows only about one request every 5 s per home after a short burst.
  var PAD_GATHER = 250; // ms
  var padKeys = [], padButtons = [], padTimer;
  function padPress(k, button) {
    padKeys.push(k);
    if (padButtons.indexOf(button) < 0) padButtons.push(button);
    if (navigator.vibrate) navigator.vibrate(10);
    if (!padTimer) padTimer = setTimeout(function () {
      var keys = padKeys.slice(0, 20), buttons = padButtons;
      padKeys = [];
      padButtons = [];
      padTimer = null;
      send({ cmd: 'keys', keys: keys }, buttons).catch(function () {});
    }, PAD_GATHER);
  }

  var paused = false; // the TV doesn't say whether something plays, so the button alternates
  function renderPlay() {
    $('pad-play').classList.toggle('paused', paused);
    $('pad-play-label').textContent = t(paused ? 'play' : 'pause');
  }

  // ---------------------------------------------------------------- volume
  // Volume is the TV's own volume keys, pressed by the Mac helper. The level itself can't be read (the
  // sound doesn't go through the TV's own volume), so the phone shows only the steps it sends, in
  // place of Mute: taps within a moment travel as one message (or every 1.2 s while you keep holding),
  // since the free relay allows only about one request every 5 s per home.
  var volPending = 0;   // steps not sent yet
  var volBurst = 0;     // steps of the current run of taps, shown as "+3"
  var VOL_SETTLE = 350; // ms after the last tap before sending
  var VOL_HOLD_EVERY = 1200;
  var volTimer, volSentAt = 0, burstTimer, volButtons = [];

  function showBurst() {
    $('vol-burst').textContent = volBurst > 0 ? '+' + volBurst : volBurst < 0 ? '−' + -volBurst : '';
    $('mute').classList.toggle('burst', volBurst !== 0);
  }

  function sendVolumeNow() {
    clearTimeout(volTimer);
    if (!volPending) return;
    var keys = [];
    for (var i = 0; i < Math.min(Math.abs(volPending), 50); i++) keys.push(volPending > 0 ? 'KEY_VOLUP' : 'KEY_VOLDOWN');
    var buttons = volButtons;
    volPending = 0;
    volButtons = [];
    volSentAt = Date.now();
    send({ cmd: 'keys', keys: keys }, buttons).catch(function () {});
  }

  function volStep(step, button) {
    volPending += step;
    if (volButtons.indexOf(button) < 0) volButtons.push(button);
    volBurst += step;
    showBurst();
    if (navigator.vibrate) navigator.vibrate(8);
    clearTimeout(volTimer);
    volTimer = setTimeout(sendVolumeNow, VOL_SETTLE);
    clearTimeout(burstTimer);
    burstTimer = setTimeout(function () { // a new run of taps starts counting from zero
      volBurst = 0;
      showBurst();
    }, 2000);
  }

  // hold − or + to keep stepping, faster after a moment
  function holdStep(button, step) {
    var repeat;
    function stop() { clearTimeout(repeat); }
    button.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      volStep(step, button);
      var delay = 380;
      (function again() {
        repeat = setTimeout(function () {
          volStep(step, button);
          if (Date.now() - volSentAt > VOL_HOLD_EVERY) sendVolumeNow(); // keep the TV following a long hold
          delay = Math.max(90, delay * 0.7);
          again();
        }, delay);
      })();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { button.addEventListener(ev, stop); });
    button.addEventListener('click', function (e) { if (e.detail === 0) volStep(step, button); }); // keyboard
  }

  // ---------------------------------------------------------------- who's using this phone
  function askWho() {
    var list = names();
    var sheet = $('sheet');
    if (me || !list.length) { sheet.hidden = true; return; }
    var box = $('sheet-names');
    box.innerHTML = '';
    list.forEach(function (name) {
      var b = el('button', { type: 'button' }, name);
      b.addEventListener('click', function () { me = name; save('me', me); sheet.hidden = true; renderWho(); });
      box.appendChild(b);
    });
    sheet.hidden = false;
  }

  function renderWho() {
    var box = $('who');
    box.innerHTML = '';
    names().forEach(function (name) {
      var c = el('button', { type: 'button', 'class': 'chip' + (me === name ? ' on' : ''), 'aria-pressed': String(me === name) }, name);
      c.addEventListener('click', function () { me = name; save('me', me); renderWho(); });
      box.appendChild(c);
    });
  }

  function renderQuick() {
    var box = $('quick');
    ['quick1', 'quick2', 'quick3', 'quick4'].forEach(function (k) {
      var c = el('button', { type: 'button', 'class': 'chip' }, t(k));
      c.addEventListener('click', function () { var msg = $('msg'); msg.value = t(k); msg.focus(); });
      box.appendChild(c);
    });
  }

  // ---------------------------------------------------------------- message: text or drawing
  var messageMode = saved('mode', 'text') === 'draw' ? 'draw' : 'text';

  function setMessageMode(mode) {
    messageMode = mode;
    save('mode', mode);
    $('mode-text').setAttribute('aria-pressed', String(mode === 'text'));
    $('mode-draw').setAttribute('aria-pressed', String(mode === 'draw'));
    $('text-mode').hidden = mode !== 'text';
    $('draw-mode').hidden = mode !== 'draw';
    if (mode === 'draw') fitBoard();
  }

  function sendMessage() {
    var box = $('msg');
    var text = box.value.trim();
    if (!text) return box.focus();
    send({ cmd: 'message', text: text }, $('send')).then(function () { box.value = ''; toast(t('sent')); }).catch(function () {});
  }

  // A drawing is kept as strokes in board coordinates (0..1 across, 0..9/16 down), so it redraws
  // sharply at any size: on screen, after Undo, and at 960x540 for the TV.
  var COLOURS = [['white', '#ffffff'], ['teal', '#5fd4c4'], ['coral', '#ff8a7a'], ['yellow', '#ffd166'], ['blue', '#7aa7ff']];
  var BRUSHES = [['thin', 5 / 320], ['medium', 9 / 320], ['thick', 14 / 320]]; // line width, share of the board's width
  var BOARD_INK = '#0e2b39'; // the board's colour, sent along so the TV shows it the same
  var strokes = [];
  var colour = saved('colour', 'coral');
  var brush = saved('brush', 1);
  var drawing = null; // the stroke under the finger

  function paint(ctx, width) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(function (s) {
      var pts = s.points;
      ctx.strokeStyle = ctx.fillStyle = s.colour;
      ctx.lineWidth = s.size * width;
      if (pts.length === 1) { // a tap: a dot
        ctx.beginPath();
        ctx.arc(pts[0][0] * width, pts[0][1] * width, s.size * width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * width, pts[0][1] * width);
      for (var i = 1; i < pts.length - 1; i++) { // smooth through the midpoints
        ctx.quadraticCurveTo(pts[i][0] * width, pts[i][1] * width,
          (pts[i][0] + pts[i + 1][0]) / 2 * width, (pts[i][1] + pts[i + 1][1]) / 2 * width);
      }
      var last = pts[pts.length - 1];
      ctx.lineTo(last[0] * width, last[1] * width);
      ctx.stroke();
    });
  }

  var boardWidth = 0;
  function fitBoard() {
    var canvas = $('board-canvas');
    var w = $('board').clientWidth;
    if (!w) return;
    var ratio = window.devicePixelRatio || 1;
    boardWidth = w;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(w * 9 / 16 * ratio);
    redraw();
  }

  var redrawQueued = false;
  function redraw() {
    redrawQueued = false;
    var canvas = $('board-canvas');
    var ctx = canvas.getContext('2d');
    var ratio = canvas.width / (boardWidth || 1);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, boardWidth, boardWidth * 9 / 16);
    paint(ctx, boardWidth);
    $('board').classList.toggle('inked', strokes.length > 0);
    $('undo').disabled = $('clear').disabled = !strokes.length;
  }

  function redrawSoon() {
    if (!redrawQueued) { redrawQueued = true; requestAnimationFrame(redraw); }
  }

  function boardPoint(e) {
    var r = $('board-canvas').getBoundingClientRect();
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.width, 0), 9 / 16)];
  }

  function wireBoard() {
    var canvas = $('board-canvas');
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* the pointer is already gone */ }
      drawing = { colour: COLOURS.filter(function (c) { return c[0] === colour; })[0][1], size: BRUSHES[brush][1], points: [boardPoint(e)], id: e.pointerId };
      strokes.push(drawing);
      redrawSoon();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing || e.pointerId !== drawing.id) return;
      var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (events.length ? events : [e]).forEach(function (ev) { drawing.points.push(boardPoint(ev)); });
      redrawSoon();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      canvas.addEventListener(ev, function () { drawing = null; });
    });
    window.addEventListener('resize', function () { if (messageMode === 'draw') fitBoard(); });
  }

  function renderDrawTools() {
    var box = $('swatches');
    box.innerHTML = '';
    COLOURS.forEach(function (c) {
      var b = el('button', { type: 'button', 'class': 'swatch-btn', 'aria-label': t(c[0]), 'aria-pressed': String(c[0] === colour) });
      b.style.setProperty('--c', c[1]);
      b.addEventListener('click', function () { colour = c[0]; save('colour', colour); renderDrawTools(); });
      box.appendChild(b);
    });
    var dot = $('brush-dot');
    dot.style.width = dot.style.height = [6, 10, 16][brush] + 'px';
    $('brush').setAttribute('aria-label', t('brush', { size: t(BRUSHES[brush][0]) }));
  }

  function sendDrawing() {
    var b = $('send-drawing');
    if (!strokes.length) { toast(t('drawFirst')); return; }
    var out = el('canvas');
    out.width = 960;
    out.height = 540;
    var ctx = out.getContext('2d');
    ctx.fillStyle = BOARD_INK;
    ctx.fillRect(0, 0, 960, 540);
    paint(ctx, 960);
    b.disabled = true;
    out.toBlob(function (blob) {
      sendFile(blob, 'drawing.png', { cmd: 'draw' }, b).then(function () {
        toast(t('sent'));
        strokes = [];
        redraw();
      }).catch(function () {}).then(function () { b.disabled = false; });
    }, 'image/png');
  }

  // ---------------------------------------------------------------- dock
  // the dock editor works on a draft until Save
  var draft = null;
  function renderDock() {
    if (!state || !state.apps) return;
    if (!draft) draft = state.apps.map(function (a) { return { label: a.label, rgb: a.rgb, hidden: a.hidden }; });
    var list = $('dock-list');
    list.innerHTML = '';
    draft.forEach(function (app, i) {
      var row = el('li', { 'class': 'dock-row' + (app.hidden ? ' off' : '') });
      row.appendChild(appIcon(app, 'swatch'));
      row.appendChild(el('span', { 'class': 'dname' }, app.label));
      [['up', -1, 'M6 15l6-6 6 6'], ['down', 1, 'M6 9l6 6 6-6']].forEach(function (m) {
        var b = el('button', { type: 'button', 'class': 'move', 'aria-label': t(m[0]) + ': ' + app.label });
        b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + m[2] + '"/></svg>';
        var j = i + m[1];
        b.disabled = j < 0 || j >= draft.length;
        b.addEventListener('click', function () {
          var moved = draft.splice(i, 1)[0];
          draft.splice(j, 0, moved);
          renderDock();
        });
        row.appendChild(b);
      });
      var s = el('button', { type: 'button', 'class': 'switch', role: 'switch', 'aria-checked': String(!app.hidden), 'aria-label': t('show') + ': ' + app.label });
      s.addEventListener('click', function () { app.hidden = !app.hidden; renderDock(); });
      row.appendChild(s);
      list.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- wallpaper and look
  function renderWalls() {
    var box = $('walls');
    box.innerHTML = '';
    var list = ((state && state.walls) || ['coast', 'dusk', 'sea', 'aurora']).slice();
    if (state && state.wallpaper === 'custom') list.push('custom');
    list.forEach(function (name) {
      var current = state && state.wallpaper === name;
      var b = el('button', { type: 'button', 'class': 'wall' + (current ? ' on' : '') + (name === 'custom' ? ' custom' : ''), 'aria-pressed': String(current) });
      if (name !== 'custom') b.style.backgroundImage = 'url(walls/' + name + '.jpg)';
      b.appendChild(el('span', {}, t(name)));
      if (name !== 'custom') {
        b.addEventListener('click', function () { send({ cmd: 'wallpaper', name: name }, b).then(function () { toast(t('wallSet')); }).catch(function () {}); });
      }
      box.appendChild(b);
    });
  }

  // The pressed button follows what TV Home says, like the wallpaper.
  function renderLook() {
    var mode = state && state.look;
    document.querySelectorAll('[data-look]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-look') === mode));
    });
    var note;
    if (mode === 'light') note = t('lookLight');
    else if (mode === 'dark') note = t('lookDark');
    else if (state && state.sun) note = t('lookAuto', { rise: state.sun.rise, set: state.sun.set });
    else note = t('lookAutoPlain');
    $('look-note').textContent = note;
  }

  function pickLook(mode, button) {
    send({ cmd: 'look', mode: mode }, button).then(function () {
      if (state) { state.look = mode; renderLook(); } // until TV Home's own answer
      toast(mode === 'auto' ? t('lookAutoSet') : t('lookSet', { look: t(mode) }));
    }).catch(function () {});
  }

  var toastTimer;
  function toast(text) {
    var box = $('toast');
    box.textContent = text;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, 2200);
  }

  // ---------------------------------------------------------------- photo upload
  // Cropped to 1920x1080 and squeezed under the relay's 2 MB limit, then sent as an attachment.
  function uploadPhoto(file) {
    var note = $('upload-note');
    note.textContent = t('uploading');
    var img = new Image();
    img.onload = function () {
      var canvas = el('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      var scale = Math.max(1920 / img.naturalWidth, 1080 / img.naturalHeight);
      var w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      canvas.getContext('2d').drawImage(img, (1920 - w) / 2, (1080 - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      (function encode(quality) {
        canvas.toBlob(function (blob) {
          if (blob.size > 1900000 && quality > 0.5) return encode(quality - 0.1);
          if (blob.size > 1900000) { note.textContent = t('tooBig'); return; }
          sendFile(blob, 'wallpaper.jpg', { cmd: 'wallpaper', custom: true }).then(function () {
            note.textContent = t('uploadHint');
            toast(t('wallSet'));
          }).catch(function () { note.textContent = t('failed'); });
        }, 'image/jpeg', quality);
      })(0.86);
    };
    img.src = URL.createObjectURL(file);
  }

  // ---------------------------------------------------------------- press and release
  // Every button shrinks while touched and springs back when let go (style.css: .pressed). Driven by
  // pointer events, since iPhone Safari shows :active on a touch only in some cases.
  var PRESSABLE = 'button, .upload';
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest ? e.target.closest(PRESSABLE) : null;
    if (!b || b.disabled) return;
    b.classList.add('pressed');
    function release() {
      b.classList.remove('pressed');
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
    }
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
  }, true);

  // ---------------------------------------------------------------- wiring
  function showPanel(name) {
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-panel') === name;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'dock') { draft = null; renderDock(); }
    if (name === 'message' && messageMode === 'draw') fitBoard();
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.getAttribute('data-panel')); });
  });

  $('status-btn').addEventListener('click', function () { showCard($('status-card').hidden); });
  document.addEventListener('click', function (e) { // a tap anywhere else closes the details
    if (!$('status-card').hidden && !e.target.closest('#status-card, #status-btn')) showCard(false);
  });
  $('refresh').addEventListener('click', function () { mark(this, 'spin'); ping(); });

  $('apps-toggle').addEventListener('click', function () { setAppsOpen(!appsOpen); });
  $('pad-home').addEventListener('click', function () {
    if (navigator.vibrate) navigator.vibrate(10);
    send({ cmd: 'home' }, this).catch(function () {});
  });
  document.querySelectorAll('[data-key]').forEach(function (b) {
    b.addEventListener('click', function () { padPress(b.getAttribute('data-key'), b); });
  });
  $('power').addEventListener('click', function () {
    var on = !tvIsOn();
    send({ cmd: 'power', on: on }, this).then(function () {
      toast(t(on ? 'turningOnToast' : 'turningOff'));
      if (on) { turningOnUntil = Date.now() + TURN_ON_WAIT; renderAll(); }
      // then ask how things are; from deep sleep the TV can take a few seconds more
      setTimeout(ping, on ? 8000 : 5000);
      if (on) setTimeout(function () { if (!tvIsOn()) { toast(t('stillOff')); ping(); } }, 20000);
    }).catch(function () {});
  });
  $('pad-play').addEventListener('click', function () {
    padPress(paused ? 'KEY_PLAY' : 'KEY_PAUSE', this);
    paused = !paused;
    renderPlay();
  });

  holdStep($('vol-up'), 1);
  holdStep($('vol-down'), -1);
  $('mute').addEventListener('click', function () {
    if (navigator.vibrate) navigator.vibrate(10);
    send({ cmd: 'keys', keys: ['KEY_MUTE'] }, this).catch(function () {}); // the remote's Mute key toggles
  });

  $('mode-text').addEventListener('click', function () { setMessageMode('text'); });
  $('mode-draw').addEventListener('click', function () { setMessageMode('draw'); });
  $('send').addEventListener('click', sendMessage);
  $('msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
  });
  $('brush').addEventListener('click', function () { brush = (brush + 1) % BRUSHES.length; save('brush', brush); renderDrawTools(); });
  $('undo').addEventListener('click', function () { strokes.pop(); redraw(); });
  $('clear').addEventListener('click', function () { strokes = []; redraw(); });
  $('send-drawing').addEventListener('click', sendDrawing);
  wireBoard();

  $('dock-save').addEventListener('click', function () {
    if (!draft) return;
    send({
      cmd: 'dock',
      order: draft.map(function (a) { return a.label; }),
      hidden: draft.filter(function (a) { return a.hidden; }).map(function (a) { return a.label; })
    }, $('dock-save')).then(function () { toast(t('saved')); }).catch(function () {});
  });
  document.querySelectorAll('[data-look]').forEach(function (b) {
    b.addEventListener('click', function () { pickLook(b.getAttribute('data-look'), b); });
  });
  $('upload').addEventListener('change', function (e) {
    if (e.target.files[0]) uploadPhoto(e.target.files[0]);
    e.target.value = '';
  });
  // back on screen: ask the TV again, but not on every quick app switch (each ask costs three relay
  // messages: the ping, TV Home's state and the Mac's answer)
  var PING_AGAIN = 60000;
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && key && Date.now() - pingAt > PING_AGAIN) ping();
  });

  renderQuick();
  renderDrawTools();
  setMessageMode(messageMode);
  renderAll();
  if (!key) {
    $('nokey').hidden = false;
  } else {
    listen();
  }
})();
