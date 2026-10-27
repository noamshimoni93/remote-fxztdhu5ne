/* Phone remote for TV Home.
   Talks to the TV through the free ntfy.sh relay: commands go to the topic "<key>-tv", the TV's
   state comes back on "<key>-phone". The key is in the personal link (#k=...), never in this page,
   so the page alone can't reach any TV. Names, apps and settings all come from the TV. */
(function () {
  'use strict';

  var RELAY = 'https://ntfy.sh/';
  var PING_WAIT = 7000; // ms to wait for the TV to answer before calling it off or asleep

  // ---------------------------------------------------------------- text (English default, he-IL translation)
  var STRINGS = {
    en: {
      remote: 'Remote', connecting: 'Connecting…', tvOn: 'TV is on', tvOff: 'TV is off or asleep',
      showing: 'Showing: {what}', homeScreen: 'TV Home', otherApp: 'another app', lastSeen: 'Last seen {when}',
      neverSeen: 'Not heard from yet', justNow: 'just now', minutesAgo: '{n} min ago', hoursAgo: '{n} h ago',
      open: 'Open on the TV', home: 'TV Home', volume: 'Volume', mute: 'Mute', muted: 'Muted',
      sendMessage: 'Send a message to the TV', from: 'From', message: 'Message', send: 'Send to the TV',
      messageHint: 'It shows on the TV for 12 seconds, even over Netflix, then goes back.',
      quick1: 'Dinner’s ready', quick2: 'On my way home', quick3: 'Movie night?', quick4: 'Love you',
      dock: 'Dock', dockHint: 'Change the order with the arrows; switch an app off to hide it.',
      save: 'Save to the TV', wallpaper: 'Wallpaper', upload: 'Use one of my photos',
      uploadHint: 'Cropped to the TV’s shape and sent through the relay.', uploading: 'Sending the photo…',
      tooBig: 'That photo is too big to send', whoTitle: 'Who’s using this phone?',
      volMac: 'Presses the TV’s own volume keys, through the Mac.',
      padTitle: 'Remote keys', ok: 'OK', back: 'Back', pause: 'Pause', play: 'Play', samsungHome: 'Home', tabPad: 'Pad',
      padHint: 'Works inside Netflix, Apple TV and the rest, like the TV remote. Quick taps are sent together, so a press can take a moment.',
      padNoMac: 'The keys are pressed by the Mac. It’s asleep or off right now, so they won’t reach the TV.',
      powerOn: 'Turn the TV on', powerOff: 'Turn the TV off', turningOn: 'Turning the TV on…',
      turningOff: 'Turning the TV off…', homeClosed: 'TV Home isn’t open', rewind: 'Rewind', forward: 'Forward',
      volNoMac: 'The Mac is asleep or off, so volume and the pad won’t reach the TV right now.',
      whoHint: 'Your name goes with your messages. You can change it on the Message tab.', tabRemote: 'Remote', tabMessage: 'Message', tabDock: 'Dock',
      tabWall: 'Wallpaper', sent: 'Sent', opening: 'Opening {app}', failed: 'Couldn’t reach the relay',
      saved: 'Saved', wallSet: 'Wallpaper changed', noKey: 'Open this page from your personal link to connect to the TV.',
      up: 'Move up', down: 'Move down', show: 'Show in the dock', weather: 'Tel Aviv: {w}',
      coast: 'Tel Aviv coast', dusk: 'Dusk ridges', sea: 'Blue-hour sea', aurora: 'Aurora lake', custom: 'Your photo',
      notAnswering: 'The TV didn’t answer'
    },
    he: {
      remote: 'שלט', connecting: 'מתחבר…', tvOn: 'הטלוויזיה דולקת', tvOff: 'הטלוויזיה כבויה או במצב שינה',
      showing: 'מוצג: {what}', homeScreen: 'מסך הבית', otherApp: 'אפליקציה אחרת', lastSeen: 'נראתה לאחרונה {when}',
      neverSeen: 'עדיין אין תשובה', justNow: 'עכשיו', minutesAgo: 'לפני {n} דק׳', hoursAgo: 'לפני {n} שע׳',
      open: 'פתיחה בטלוויזיה', home: 'מסך הבית', volume: 'עוצמת קול', mute: 'השתקה', muted: 'מושתק',
      sendMessage: 'שליחת הודעה לטלוויזיה', from: 'מאת', message: 'הודעה', send: 'שליחה לטלוויזיה',
      messageHint: 'ההודעה מוצגת בטלוויזיה 12 שניות, גם מעל נטפליקס, ואז חוזרים.',
      quick1: 'האוכל מוכן', quick2: 'בדרך הביתה', quick3: 'ערב סרט?', quick4: 'אוהב אותך',
      dock: 'סרגל האפליקציות', dockHint: 'שינוי הסדר בעזרת החצים; כיבוי אפליקציה מסתיר אותה.',
      save: 'שמירה בטלוויזיה', wallpaper: 'רקע', upload: 'שימוש בתמונה שלי',
      uploadHint: 'התמונה נחתכת לצורת המסך ונשלחת דרך הממסר.', uploading: 'שולח את התמונה…',
      tooBig: 'התמונה גדולה מדי לשליחה', whoTitle: 'מי משתמש בטלפון הזה?',
      volMac: 'לוחץ על מקשי עוצמת הקול של הטלוויזיה עצמה, דרך המק.',
      padTitle: 'מקשי השלט', ok: 'אישור', back: 'חזרה', pause: 'השהיה', play: 'הפעלה', samsungHome: 'בית', tabPad: 'שלט',
      padHint: 'עובד בתוך נטפליקס, Apple TV ושאר האפליקציות, כמו השלט של הטלוויזיה. לחיצות מהירות נשלחות יחד, כך שלחיצה יכולה להתעכב רגע.',
      padNoMac: 'את המקשים לוחץ המק. כרגע הוא כבוי או במצב שינה, ולכן הם לא יגיעו לטלוויזיה.',
      powerOn: 'הדלקת הטלוויזיה', powerOff: 'כיבוי הטלוויזיה', turningOn: 'הטלוויזיה נדלקת…',
      turningOff: 'הטלוויזיה נכבית…', homeClosed: 'מסך הבית לא פתוח', rewind: 'אחורה', forward: 'קדימה',
      volNoMac: 'המק כבוי או במצב שינה, ולכן עוצמת הקול והשלט לא יגיעו לטלוויזיה כרגע.',
      whoHint: 'השם מצורף להודעות. אפשר לשנות אותו בלשונית ההודעות.', tabRemote: 'שלט', tabMessage: 'הודעה', tabDock: 'סרגל',
      tabWall: 'רקע', sent: 'נשלח', opening: 'פותח את {app}', failed: 'אין חיבור לממסר',
      saved: 'נשמר', wallSet: 'הרקע הוחלף', noKey: 'יש לפתוח את הדף מהקישור האישי כדי להתחבר לטלוויזיה.',
      up: 'הזזה למעלה', down: 'הזזה למטה', show: 'הצגה בסרגל', weather: 'תל אביב: {w}',
      coast: 'חוף תל אביב', dusk: 'רכסים בשקיעה', sea: 'ים בשעה הכחולה', aurora: 'זוהר צפוני', custom: 'התמונה שלך',
      notAnswering: 'הטלוויזיה לא ענתה'
    }
  };

  var lang = 'en';
  try { lang = localStorage.getItem('tvremote.lang') === 'he' ? 'he' : 'en'; } catch (e) { /* storage unavailable */ }

  function t(key, vars) {
    return (STRINGS[lang][key] || STRINGS.en[key] || key).replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; });
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
    document.getElementById('lang').textContent = lang === 'he' ? 'EN' : 'עב';
    renderAll();
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

  function send(command) {
    command.v = 1;
    if (me) command.from = me;
    return fetch(RELAY + key + '-tv', { method: 'POST', body: JSON.stringify(command) }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
    }).catch(function () {
      toast(t('failed'));
      throw new Error('relay');
    });
  }

  function ping() {
    pingAt = Date.now();
    setStatus('wait');
    clearTimeout(pingTimer);
    pingTimer = setTimeout(function () { if (!state || state.at < pingAt - 2000) setStatus('off'); }, PING_WAIT);
    send({ cmd: 'ping' }).catch(function () { setStatus('off'); });
  }

  function takeState(message) {
    var s;
    try { s = JSON.parse(message); } catch (e) { return; }
    if (!s || s.v !== 1 || s.kind !== 'state') return;
    if (state && s.at < state.at) return;
    state = s;
    save('state', s);
    renderAll();
    setStatus('on');
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

  // ---------------------------------------------------------------- status
  var statusMode = 'wait';
  function setStatus(mode) {
    statusMode = mode;
    var fresh = state && state.at >= pingAt - 2000;
    if (mode === 'on' && !fresh) mode = statusMode = 'off';
    document.getElementById('status-dot').className = 'dot ' + (mode === 'on' ? 'on' : mode === 'wait' ? 'wait' : '');
    var main = document.getElementById('status-main');
    var sub = document.getElementById('status-sub');
    if (mode === 'wait') {
      main.textContent = t('connecting');
      sub.textContent = '';
    } else if (mode === 'on') {
      main.textContent = t('tvOn');
      var what = state.front === 'home' ? t('homeScreen') : state.front === 'other' ? t('otherApp') : state.front;
      sub.textContent = t('showing', { what: what }) + (state.weather ? ' · ' + t('weather', { w: state.weather }) : '');
    } else if (macOn() && tvPower === 'on') {
      document.getElementById('status-dot').className = 'dot on';
      main.textContent = t('tvOn');
      sub.textContent = t('homeClosed');
    } else {
      main.textContent = t('tvOff');
      sub.textContent = state ? t('lastSeen', { when: ago(state.at) }) : t('neverSeen');
    }
  }

  function ago(at) {
    var min = Math.round((Date.now() - at) / 60000);
    if (min < 1) return t('justNow');
    if (min < 60) return t('minutesAgo', { n: min });
    return t('hoursAgo', { n: Math.round(min / 60) });
  }

  // ---------------------------------------------------------------- rendering
  function names() {
    // "Noam & Amir", or the Hebrew "נועם ואמיר" (the "and" is a ו prefix)
    return state && state.names ? state.names.split(/\s+&\s+|\s+ו(?=\S)/).filter(Boolean) : [];
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
    document.getElementById('brand').textContent = state && state.names ? state.names : 'TV';
    renderApps();
    renderVolume();
    renderWho();
    renderQuick();
    renderDock();
    renderWalls();
    renderPlay();
    setStatus(statusMode);
    renderPower();
    askWho();
  }

  function renderApps() {
    var box = document.getElementById('apps');
    box.innerHTML = '';
    ((state && state.apps) || []).forEach(function (app) {
      var b = el('button', { type: 'button', 'class': 'app-btn' + (app.hidden ? ' off' : '') + (isLight(app.rgb) ? ' light' : '') });
      b.style.setProperty('--rgb', app.rgb);
      b.appendChild(el('span', { 'class': 'tile', 'aria-hidden': 'true' }, app.label.charAt(0)));
      b.appendChild(el('span', { 'class': 'name' }, app.label));
      b.addEventListener('click', function () {
        send({ cmd: 'open', app: app.label }).then(function () { toast(t('opening', { app: app.label })); });
      });
      box.appendChild(b);
    });
  }

  // the Mac helper presses the TV's real keys; its answers to pings say it's there, and the TV's power
  var macAt = 0, tvPower = null;
  function takeAck(a) {
    macAt = Date.now();
    tvPower = a.tv || null;
    renderAll();
  }

  function macOn() {
    return Date.now() - macAt < 60000 || !!(state && state.helperAt && state.at - state.helperAt < 15000);
  }

  function tvIsOn() {
    return statusMode === 'on' || (macOn() && tvPower === 'on');
  }

  function renderPower() {
    var b = document.getElementById('power');
    var on = tvIsOn();
    b.classList.toggle('on', on);
    b.disabled = !macOn();
    document.getElementById('power-label').textContent = t(on ? 'powerOff' : 'powerOn');
  }

  // ---------------------------------------------------------------- remote pad
  // Keys go to the Mac helper, which presses them on the TV. Taps within a short moment travel as one
  // message: the free relay allows only about one request every 5 s per home after a short burst.
  var PAD_GATHER = 250; // ms
  var padKeys = [], padTimer;
  function padPress(key) {
    padKeys.push(key);
    if (navigator.vibrate) navigator.vibrate(10);
    if (!padTimer) padTimer = setTimeout(function () {
      var keys = padKeys.slice(0, 20);
      padKeys = [];
      padTimer = null;
      send({ cmd: 'keys', keys: keys }).catch(function () {});
    }, PAD_GATHER);
  }

  var paused = false; // the TV doesn't say whether something plays, so the button alternates
  function renderPlay() {
    var b = document.getElementById('pad-play');
    b.classList.toggle('paused', paused);
    document.getElementById('pad-play-label').textContent = t(paused ? 'play' : 'pause');
  }

  // ---------------------------------------------------------------- volume
  // Volume is the TV's own volume keys, pressed by the Mac helper: a change from 10 to 14 is four
  // KEY_VOLUP presses, sent as one message when you let go (or every 1.2 s while you keep holding);
  // the free relay allows only about one request every 5 s per home. The phone shows the change at
  // once; the TV's reports are ignored for a moment so the slider doesn't jump back meanwhile.
  var vol = null, muted = false, localUntil = 0;
  var volSent = null; // the volume the keys sent so far will leave the TV at

  function renderVolume() {
    if (state && typeof state.volume === 'number' && Date.now() > localUntil) {
      vol = volSent = state.volume;
      muted = !!state.muted;
    }
    var slider = document.getElementById('vol-slider');
    document.getElementById('vol-num').textContent = vol === null ? '–' : muted ? '0' : vol;
    slider.value = vol === null ? 0 : Math.min(vol, Number(slider.max));
    slider.style.setProperty('--fill', (slider.value / slider.max * 100) + '%');
    slider.disabled = vol === null;
    var mute = document.getElementById('mute');
    mute.classList.toggle('on', muted);
    mute.setAttribute('aria-pressed', String(muted));
    document.getElementById('mute-label').textContent = t(muted ? 'muted' : 'mute');
    document.querySelector('.volume').classList.toggle('muted', muted);
    // the Mac helper presses the TV's real volume keys; TV Home reports when it last answered
    var hint = document.getElementById('vol-hint');
    hint.hidden = !state || !('helperAt' in state);
    if (!hint.hidden) hint.textContent = t(macOn() ? 'volMac' : 'volNoMac');
    var padNote = document.getElementById('pad-note');
    padNote.hidden = !state || !('helperAt' in state) || macOn();
    padNote.textContent = t('padNoMac');
  }

  var VOL_SETTLE = 350;   // ms after the last change before sending
  var VOL_HOLD_EVERY = 1200;
  var volTimer, volSentAt = 0;
  function sendVolumeNow() {
    clearTimeout(volTimer);
    if (vol === null || volSent === null || vol === volSent) return;
    var diff = vol - volSent;
    var keys = [];
    for (var i = 0; i < Math.min(Math.abs(diff), 50); i++) keys.push(diff > 0 ? 'KEY_VOLUP' : 'KEY_VOLDOWN');
    volSentAt = Date.now();
    volSent = vol;
    localUntil = Date.now() + 4000;
    send({ cmd: 'keys', keys: keys }).catch(function () {});
  }

  function setVolume(level) {
    if (vol === null) return;
    vol = Math.max(0, Math.min(100, level));
    muted = false;
    localUntil = Date.now() + 4000;
    renderVolume();
    if (navigator.vibrate) navigator.vibrate(8);
    clearTimeout(volTimer);
    volTimer = setTimeout(sendVolumeNow, VOL_SETTLE);
  }

  // hold − or + to keep stepping, faster after a moment
  function holdStep(button, step) {
    var repeat;
    function stop() { clearTimeout(repeat); }
    button.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      setVolume(vol + step);
      var delay = 380;
      (function again() {
        repeat = setTimeout(function () {
          setVolume(vol + step);
          if (Date.now() - volSentAt > VOL_HOLD_EVERY) sendVolumeNow(); // keep the TV following a long hold
          delay = Math.max(90, delay * 0.7);
          again();
        }, delay);
      })();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { button.addEventListener(ev, stop); });
    button.addEventListener('click', function (e) { if (e.detail === 0) setVolume(vol + step); }); // keyboard
  }

  function askWho() {
    var list = names();
    var sheet = document.getElementById('sheet');
    if (me || !list.length) { sheet.hidden = true; return; }
    var box = document.getElementById('sheet-names');
    box.innerHTML = '';
    list.forEach(function (name) {
      var b = el('button', { type: 'button' }, name);
      b.addEventListener('click', function () { me = name; save('me', me); sheet.hidden = true; renderWho(); });
      box.appendChild(b);
    });
    sheet.hidden = false;
  }

  function renderWho() {
    var box = document.getElementById('who');
    box.innerHTML = '';
    names().forEach(function (name) {
      var c = el('button', { type: 'button', 'class': 'chip' + (me === name ? ' on' : ''), 'aria-pressed': String(me === name) }, name);
      c.addEventListener('click', function () { me = name; save('me', me); renderWho(); });
      box.appendChild(c);
    });
  }

  function renderQuick() {
    var box = document.getElementById('quick');
    box.innerHTML = '';
    ['quick1', 'quick2', 'quick3', 'quick4'].forEach(function (k) {
      var c = el('button', { type: 'button', 'class': 'chip' }, t(k));
      c.addEventListener('click', function () { var box = document.getElementById('msg'); box.value = t(k); box.focus(); });
      box.appendChild(c);
    });
  }

  // the dock editor works on a draft until Save
  var draft = null;
  function renderDock() {
    if (!state || !state.apps) return;
    if (!draft) draft = state.apps.map(function (a) { return { label: a.label, rgb: a.rgb, hidden: a.hidden }; });
    var list = document.getElementById('dock-list');
    list.innerHTML = '';
    draft.forEach(function (app, i) {
      var row = el('li', { 'class': 'dock-row' + (app.hidden ? ' off' : '') });
      var sw = el('span', { 'class': 'swatch', 'aria-hidden': 'true' });
      sw.style.setProperty('--rgb', app.rgb);
      row.appendChild(sw);
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

  var WALL_LOOKS = {
    coast: 'linear-gradient(160deg, #6f9ccc 0%, #c9d6e6 40%, #2f7d84 62%, #0d4a55 100%)',
    dusk: 'linear-gradient(180deg, #1b1c42 0%, #93648a 50%, #2a2550 70%, #0b0a1a 100%)',
    sea: 'linear-gradient(180deg, #040817 0%, #2c4c85 50%, #263c68 60%, #050a19 100%)',
    aurora: 'linear-gradient(180deg, #01040c 0%, #1f7f6a 35%, #041226 60%, #050b11 100%)',
    custom: 'linear-gradient(135deg, #2b3a47, #51606e)'
  };

  function renderWalls() {
    var box = document.getElementById('walls');
    box.innerHTML = '';
    var list = ((state && state.walls) || ['coast', 'dusk', 'sea', 'aurora']).slice();
    if (state && state.wallpaper === 'custom') list.push('custom');
    list.forEach(function (name) {
      var current = state && state.wallpaper === name;
      var b = el('button', { type: 'button', 'class': 'wall' + (current ? ' on' : ''), 'aria-pressed': String(current) });
      b.style.background = WALL_LOOKS[name] || WALL_LOOKS.custom;
      b.appendChild(el('span', {}, t(name)));
      if (name !== 'custom') {
        b.addEventListener('click', function () { send({ cmd: 'wallpaper', name: name }).then(function () { toast(t('wallSet')); }); });
      }
      box.appendChild(b);
    });
  }

  var toastTimer;
  function toast(text) {
    var box = document.getElementById('toast');
    box.textContent = text;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, 2200);
  }

  // ---------------------------------------------------------------- photo upload
  // Cropped to 1920x1080 and squeezed under the relay's 2 MB limit, then sent as an attachment.
  function uploadPhoto(file) {
    var note = document.getElementById('upload-note');
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
          fetch(RELAY + key + '-tv', {
            method: 'PUT',
            body: blob,
            headers: { 'Filename': 'wallpaper.jpg', 'Message': JSON.stringify({ v: 1, cmd: 'wallpaper', custom: true }) }
          }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            note.textContent = t('uploadHint');
            toast(t('wallSet'));
          }).catch(function () {
            note.textContent = t('failed');
          });
        }, 'image/jpeg', quality);
      })(0.86);
    };
    img.src = URL.createObjectURL(file);
  }

  // ---------------------------------------------------------------- wiring
  function showPanel(name) {
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-panel') === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (name === 'dock') { draft = null; renderDock(); }
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.getAttribute('data-panel')); });
  });
  document.getElementById('lang').addEventListener('click', function () {
    lang = lang === 'he' ? 'en' : 'he';
    try { localStorage.setItem('tvremote.lang', lang); } catch (e) { /* storage unavailable */ }
    applyLanguage();
  });
  document.getElementById('refresh').addEventListener('click', ping);
  document.getElementById('home').addEventListener('click', function () { send({ cmd: 'home' }); });
  document.querySelectorAll('[data-key]').forEach(function (b) {
    b.addEventListener('click', function () { padPress(b.getAttribute('data-key')); });
  });
  document.getElementById('power').addEventListener('click', function () {
    var on = !tvIsOn();
    send({ cmd: 'power', on: on }).then(function () {
      toast(t(on ? 'turningOn' : 'turningOff'));
      setTimeout(ping, on ? 12000 : 5000); // then ask again how things are
    }).catch(function () {});
  });
  document.getElementById('pad-play').addEventListener('click', function () {
    padPress(paused ? 'KEY_PLAY' : 'KEY_PAUSE');
    paused = !paused;
    renderPlay();
  });

  holdStep(document.getElementById('vol-up'), 1);
  holdStep(document.getElementById('vol-down'), -1);
  document.getElementById('vol-slider').addEventListener('input', function (e) { setVolume(Number(e.target.value)); });
  document.getElementById('mute').addEventListener('click', function () {
    if (vol === null) return;
    muted = !muted; // the remote's Mute key toggles
    localUntil = Date.now() + 4000;
    renderVolume();
    send({ cmd: 'keys', keys: ['KEY_MUTE'] }).catch(function () {});
  });

  function sendMessage() {
    var box = document.getElementById('msg');
    var text = box.value.trim();
    if (!text) return box.focus();
    send({ cmd: 'message', text: text }).then(function () { box.value = ''; toast(t('sent')); });
  }
  document.getElementById('send').addEventListener('click', sendMessage);
  document.getElementById('msg').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('dock-save').addEventListener('click', function () {
    if (!draft) return;
    send({
      cmd: 'dock',
      order: draft.map(function (a) { return a.label; }),
      hidden: draft.filter(function (a) { return a.hidden; }).map(function (a) { return a.label; })
    }).then(function () { toast(t('saved')); });
  });
  document.getElementById('upload').addEventListener('change', function (e) {
    if (e.target.files[0]) uploadPhoto(e.target.files[0]);
    e.target.value = '';
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && key) ping(); });

  applyLanguage();
  if (!key) {
    document.getElementById('nokey').hidden = false;
  } else {
    listen();
  }
})();
