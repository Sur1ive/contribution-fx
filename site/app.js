import { render, THEMES, PALETTES, demoCalendar, fetchPublic } from './src/index.js';

const DEFAULTS = { theme: 'gravity', palette: 'github', mode: 'light', speed: 1, label: false };
const THEME_NAMES = Object.keys(THEMES);
const PALETTE_NAMES = Object.keys(PALETTES);
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const HERO_CYCLE_MS = 10000;

// Used only while a theme still ships without its own description.
const FALLBACK_DESCRIPTIONS = {
  gravity: 'Cells fall and stack at the bottom of each week, then float back.',
  life: "Conway's Game of Life, seeded by your graph.",
  sort: 'Every cell travels to its sorted place, forming a gradient.',
  ripple: 'Your busiest days send shockwaves across the graph.',
  fireworks: 'Your best days launch fireworks.',
};

const $ = (sel, root = document) => root.querySelector(sel);
const prefersDark = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const demo = demoCalendar('octocat');
const cache = new Map();

const state = readUrl();
let calendar = demo;
let currentSvg = '';
let loadToken = 0;

function describe(name) {
  const d = THEMES[name]?.description;
  return d && d !== 'placeholder' ? d : FALLBACK_DESCRIPTIONS[name] ?? '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function safeRender(cal, opts) {
  try {
    return { svg: render(cal, opts) };
  } catch (error) {
    return { error };
  }
}

/** Show an SVG string through an <img>, exactly like GitHub does with README images. */
function setImage(img, svg) {
  const old = img.dataset.url;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const size = svg.match(/^<svg[^>]*\swidth="(\d+(?:\.\d+)?)"[^>]*\sheight="(\d+(?:\.\d+)?)"/);
  if (size) {
    img.width = Math.round(Number(size[1]));
    img.height = Math.round(Number(size[2]));
  }
  img.dataset.url = url;
  img.src = url;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
}

/* ---------- URL state ---------- */

function readUrl() {
  const p = new URLSearchParams(location.search);
  const speed = Number(p.get('speed'));
  const user = (p.get('user') ?? '').trim().replace(/^@/, '');
  return {
    user: USERNAME.test(user) ? user : '',
    theme: THEME_NAMES.includes(p.get('theme')) ? p.get('theme') : DEFAULTS.theme,
    palette: PALETTE_NAMES.includes(p.get('palette')) ? p.get('palette') : DEFAULTS.palette,
    mode: ['light', 'dark'].includes(p.get('mode')) ? p.get('mode') : prefersDark.matches ? 'dark' : 'light',
    speed: speed >= 0.25 && speed <= 3 ? Math.round(speed * 4) / 4 : DEFAULTS.speed,
    label: ['true', '1'].includes(p.get('label')),
  };
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.user) p.set('user', state.user);
  for (const key of ['theme', 'palette', 'mode', 'speed', 'label']) {
    if (state[key] !== DEFAULTS[key]) p.set(key, String(state[key]));
  }
  const qs = p.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

/* ---------- pixel headline ---------- */

const GLYPHS = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
};

function buildPixelWord(word) {
  const columns = [];
  [...word].forEach((ch, i) => {
    if (i) columns.push('.......');
    const g = GLYPHS[ch];
    for (let x = 0; x < g[0].length; x++) columns.push(g.map((row) => row[x]).join(''));
  });
  const width = columns.length * 14 - 3;
  const rects = [];
  const on = [];
  columns.forEach((col, x) => {
    for (let y = 0; y < 7; y++) {
      const lit = col[y] === '#';
      const level = lit ? [2, 3, 3, 4, 4][Math.floor(Math.random() * 5)] : 0;
      const delay = lit ? Math.round(x * 28 + y * 22 + Math.random() * 60) : 0;
      rects.push(`<rect x="${x * 14}" y="${y * 14}" width="11" height="11" rx="2" class="p${level}${lit ? ' on' : ''}"${lit ? ` style="--d:${delay}ms"` : ''}/>`);
    }
  });
  const host = $('.pixel-word');
  host.innerHTML = `<svg viewBox="0 0 ${width} 95">${rects.join('')}</svg>`;
  host.querySelectorAll('.on').forEach((r) => on.push(r));
  if (reducedMotion.matches) return;
  setInterval(() => {
    if (document.hidden) return;
    for (let k = 0; k < 3; k++) {
      const r = on[Math.floor(Math.random() * on.length)];
      r.setAttribute('class', `p${[1, 2, 3, 3, 4, 4][Math.floor(Math.random() * 6)]} on`);
    }
  }, 700);
}

/* ---------- hero showcase ---------- */

function initHero() {
  const tabs = $('.hero-tabs');
  const img = $('.hero-img');
  const caption = $('.hero-caption');
  let index = 0;
  let timer = null;
  let paused = reducedMotion.matches;
  tabs.style.setProperty('--cycle', `${HERO_CYCLE_MS}ms`);
  tabs.dataset.paused = String(paused);

  tabs.innerHTML = THEME_NAMES.map(
    (name) => `<button type="button" role="tab" data-theme="${name}" aria-selected="false">${name}</button>`,
  ).join('');

  const show = (i) => {
    index = (i + THEME_NAMES.length) % THEME_NAMES.length;
    const name = THEME_NAMES[index];
    const { svg } = safeRender(demo, { theme: name, mode: prefersDark.matches ? 'dark' : 'light' });
    if (svg) setImage(img, svg);
    img.alt = `Animated contribution graph using the ${name} effect`;
    caption.textContent = describe(name);
    tabs.querySelectorAll('button').forEach((b) => {
      const selected = b.dataset.theme === name;
      b.setAttribute('aria-selected', String(selected));
      // restart the progress bar animation
      if (selected) b.replaceWith(b.cloneNode(true));
    });
    schedule();
  };

  const schedule = () => {
    clearTimeout(timer);
    if (!paused) timer = setTimeout(() => show(index + 1), HERO_CYCLE_MS);
  };

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    paused = true;
    tabs.dataset.paused = 'true';
    show(THEME_NAMES.indexOf(b.dataset.theme));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else schedule();
  });
  prefersDark.addEventListener('change', () => show(index));

  show(0);
}

/* ---------- playground ---------- */

function buildControls() {
  $('#effects').innerHTML = THEME_NAMES.map(
    (name) => `<label class="effect">
      <input type="radio" name="theme" value="${name}" />
      <span class="effect-name">${escapeHtml(THEMES[name].name ?? name)}</span>
      <span class="effect-desc">${escapeHtml(describe(name))}</span>
    </label>`,
  ).join('');

  $('#palettes').innerHTML = PALETTE_NAMES.map(
    (name) => `<label class="swatch" title="${name}">
      <input type="radio" name="palette" value="${name}" />
      <span class="swatch-cells" data-palette="${name}"></span>
      <span class="swatch-name">${name}</span>
    </label>`,
  ).join('');
}

function paintSwatches() {
  document.querySelectorAll('.swatch-cells').forEach((el) => {
    const { levels } = PALETTES[el.dataset.palette][state.mode];
    el.style.background = state.mode === 'dark' ? '#0d1117' : '#ffffff';
    el.innerHTML = levels.map((c) => `<i style="background:${c}"></i>`).join('');
  });
}

function syncControls() {
  $(`input[name="theme"][value="${state.theme}"]`).checked = true;
  $(`input[name="palette"][value="${state.palette}"]`).checked = true;
  $(`input[name="mode"][value="${state.mode}"]`).checked = true;
  $('#speed').value = String(state.speed);
  $('#speed-out').textContent = `${state.speed}×`;
  $('#label').checked = state.label;
}

function renderPreview() {
  const stage = $('#stage');
  const img = $('#preview');
  const errorEl = $('#stage-error');
  stage.dataset.mode = state.mode;
  const { svg, error } = safeRender(calendar, {
    theme: state.theme,
    palette: state.palette,
    mode: state.mode,
    speed: state.speed,
    label: state.label,
  });
  if (error) {
    currentSvg = '';
    img.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = `The ${state.theme} effect couldn't render: ${error.message}`;
  } else {
    currentSvg = svg;
    img.hidden = false;
    errorEl.hidden = true;
    setImage(img, svg);
    img.alt = `@${calendar.user}'s contribution graph with the ${state.theme} effect`;
  }
  $('#stage-title').textContent = `${calendar.user} / README.md · ${state.theme}`;
  $('#download-btn').disabled = !currentSvg;
}

let frame = 0;
function update() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    renderPreview();
    paintSwatches();
    renderSnippets();
    writeUrl();
  });
}

function setStatus(kind, text) {
  const el = $('#status');
  el.dataset.state = kind;
  el.textContent = text;
}

function demoStatus() {
  setStatus('demo', 'Showing demo data. Enter a username to see a real year.');
}

async function loadUser(raw) {
  const name = raw.trim().replace(/^@/, '');
  const token = ++loadToken;
  const btn = $('#load-btn');
  if (!name) {
    state.user = '';
    calendar = demo;
    demoStatus();
    update();
    return;
  }
  if (!USERNAME.test(name)) {
    setStatus('error', `“${name}” isn't a valid GitHub username. Use letters, numbers and single hyphens.`);
    return;
  }
  setStatus('loading', `Loading @${name}'s last year…`);
  btn.setAttribute('aria-busy', 'true');
  $('#stage').setAttribute('aria-busy', 'true');
  try {
    const key = name.toLowerCase();
    let cal = cache.get(key);
    if (!cal) {
      cal = await fetchPublic(name);
      cache.set(key, cal);
    }
    if (token !== loadToken) return;
    if (!cal.days.length) throw new Error('empty');
    state.user = name;
    calendar = cal;
    setStatus('ok', `@${name} · ${cal.total.toLocaleString('en-US')} contributions in the last year`);
  } catch (error) {
    if (token !== loadToken) return;
    const notFound = /\b404\b/.test(error.message) || error.message === 'empty';
    const fallback = calendar === demo ? 'Showing demo data for now.' : `Still showing @${calendar.user}.`;
    setStatus(
      'error',
      notFound
        ? `No GitHub user named @${name}. Check the spelling and try again.`
        : `Couldn't reach the contributions API, so @${name} didn't load. ${fallback}`,
    );
  } finally {
    if (token === loadToken) {
      btn.removeAttribute('aria-busy');
      $('#stage').removeAttribute('aria-busy');
    }
  }
  update();
}

function bindControls() {
  $('#user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadUser($('#user').value);
  });
  $('#user').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    loadUser(e.target.value);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'theme') state.theme = t.value;
    else if (t.name === 'palette') state.palette = t.value;
    else if (t.name === 'mode') state.mode = t.value;
    else if (t.id === 'label') state.label = t.checked;
    else return;
    update();
  });

  $('#speed').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('#speed-out').textContent = `${state.speed}×`;
    update();
  });

  $('#download-btn').addEventListener('click', () => {
    if (!currentSvg) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([currentSvg], { type: 'image/svg+xml' }));
    a.download = `contribution-fx-${state.theme}${state.mode === 'dark' ? '-dark' : ''}.svg`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('SVG downloaded');
  });

  $('#share-btn').addEventListener('click', async () => {
    await copy(location.href);
    toast('Link copied');
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copy(snippets[btn.dataset.copy]);
      btn.textContent = 'Copied';
      btn.dataset.copied = '';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.textContent = 'Copy';
        delete btn.dataset.copied;
      }, 1600);
    });
  });
}

/* ---------- snippets ---------- */

const snippets = { workflow: '', readme: '' };

function outputQuery(dark) {
  const p = new URLSearchParams();
  p.set('theme', state.theme);
  if (state.palette !== DEFAULTS.palette) p.set('palette', state.palette);
  if (state.speed !== DEFAULTS.speed) p.set('speed', String(state.speed));
  if (state.label) p.set('label', 'true');
  if (dark) p.set('mode', 'dark');
  return p.toString();
}

function workflowText() {
  return `name: contribution-fx

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: Sur1ive/contribution-fx@v1
        with:
          github_user_name: \${{ github.repository_owner }}
          outputs: |
            dist/contribution-fx.svg?${outputQuery(false)}
            dist/contribution-fx-dark.svg?${outputQuery(true)}

      - uses: crazy-max/ghaction-github-pages@v5
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
}

function readmeText(user) {
  const base = `https://raw.githubusercontent.com/${user}/${user}/output`;
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${base}/contribution-fx-dark.svg" />
  <img alt="contribution-fx" src="${base}/contribution-fx.svg" />
</picture>
`;
}

function highlightYaml(text) {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => {
      const html = escapeHtml(line);
      const output = line.match(/^(\s*)(dist\/[^?]+)\?(.*)$/);
      if (output) {
        return `<span class="ln dyn">${output[1]}<span class="tok-o">${escapeHtml(output[2])}</span>?<span class="tok-q">${escapeHtml(output[3])}</span></span>`;
      }
      const kv = html.match(/^(\s*)(- )?([\w-]+)(:)(.*)$/);
      if (!kv) return `<span class="ln">${html || ' '}</span>`;
      const [, indent, dash = '', key, colon, rest] = kv;
      const value = rest
        .replace(/(\$\{\{.*?\}\})/g, '<span class="tok-v">$1</span>')
        .replace(/(&quot;.*?&quot;)/g, '<span class="tok-s">$1</span>')
        .replace(/^(\s+)([\w./@-]+)$/, '$1<span class="tok-s">$2</span>');
      return `<span class="ln">${indent}${dash}<span class="tok-k">${key}</span>${colon}${value}</span>`;
    })
    .join('');
}

function highlightHtml(text) {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => {
      const html = escapeHtml(line)
        .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-t">$2</span>')
        .replace(/([\w-]+)=(&quot;.*?&quot;)/g, '<span class="tok-a">$1</span>=<span class="tok-s">$2</span>');
      return `<span class="ln">${html}</span>`;
    })
    .join('');
}

function renderSnippets() {
  const user = state.user || '<your-username>';
  snippets.workflow = workflowText();
  snippets.readme = readmeText(user);
  $('#workflow-code').innerHTML = highlightYaml(snippets.workflow);
  $('#readme-code').innerHTML = highlightHtml(snippets.readme);

  $('#repo-name').textContent = `${user}/${user}`;
  const repoLink = $('#repo-link');
  const links = [$('#new-file-link'), $('#actions-link'), $('#readme-link')];
  if (state.user) {
    const repo = `https://github.com/${state.user}/${state.user}`;
    repoLink.href = repo;
    $('#new-file-link').href = `${repo}/new/main?filename=.github/workflows/contribution-fx.yml&value=${encodeURIComponent(snippets.workflow)}`;
    $('#actions-link').href = `${repo}/actions/workflows/contribution-fx.yml`;
    $('#readme-link').href = `${repo}/edit/main/README.md`;
    links.forEach((a) => (a.hidden = false));
  } else {
    repoLink.href = 'https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme';
    links.forEach((a) => (a.hidden = true));
  }
}

/* ---------- gallery ---------- */

function buildGallery() {
  const list = $('#gallery');
  list.innerHTML = THEME_NAMES.map(
    (name) => `<article class="gallery-item" id="effect-${name}">
      <div>
        <h3>${escapeHtml(THEMES[name].name ?? name)}</h3>
        <p>${escapeHtml(describe(name))}</p>
        <code class="query">?theme=${name}</code>
        <button class="text-link" type="button" data-try="${name}">Try it with your graph <span aria-hidden="true">↑</span></button>
      </div>
      <div class="gallery-media"><img alt="The ${name} effect on a demo contribution graph" loading="lazy" decoding="async" width="771" height="130" /></div>
    </article>`,
  ).join('');

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    state.theme = b.dataset.try;
    syncControls();
    update();
    $('#playground').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  paintGallery();
  prefersDark.addEventListener('change', paintGallery);
}

function paintGallery() {
  const mode = prefersDark.matches ? 'dark' : 'light';
  THEME_NAMES.forEach((name) => {
    const img = $(`#effect-${name} img`);
    const { svg } = safeRender(demo, { theme: name, mode });
    if (svg) setImage(img, svg);
  });
}

/* ---------- utils ---------- */

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.dataset.show = '';
  clearTimeout(el._t);
  el._t = setTimeout(() => delete el.dataset.show, 1600);
}

/* ---------- boot ---------- */

buildPixelWord('alive.');
initHero();
buildControls();
syncControls();
$('#user').value = state.user;
bindControls();
buildGallery();
demoStatus();
update();
if (state.user) loadUser(state.user);
