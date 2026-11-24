(() => {
  const publicDashboard = window.TokenPulseWeb;
  const colorVariables = { codex: '--cyan', claude: '--amber', workbuddy: '--lavender' };
  const colors = {};
  const names = { codex: 'Codex', claude: 'Claude Code', workbuddy: 'Workbuddy' };
  const state = {
    range: '30', source: '', data: null, accountData: null,
    renderKey: null, request: null, pollTimer: null, dayIndex: 0,
  };
  const $ = (s) => document.querySelector(s);
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const name = (id) => names[id] || id || '未知渠道';
  const numeric = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;
  const { format: fmt, integer } = window.computeUnits;
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  function notice(text, kind) {
    const el = $('#notice'); el.hidden = !text; el.className = 'notice' + (kind ? ' notice--' + kind : ''); el.textContent = text || '';
  }
  function status(text, kind) { const el = $('#data-state'); el.textContent = text; el.className = 'state state--' + kind; }
  function label(el, value) { $(el).textContent = value; }

  function renderMetrics(data) {
    const t = data.totals || {};
    label('#metric-total', fmt(t.total)); label('#metric-total-note', state.source ? name(state.source) + ' · 筛选后' : '筛选范围内总量');
    label('#metric-days', t.activeDays ?? '—'); label('#metric-days-note', '有记录用量的自然日');
    label('#metric-sessions', integer(t.sessions)); label('#metric-sessions-note', publicDashboard ? '摘要中的会话数' : '已去重的本地会话');
    const split = t.input !== null && t.input !== undefined || t.output !== null && t.output !== undefined;
    label('#metric-split', split ? fmt(t.input) + ' / ' + fmt(t.output) : '—');
    label('#metric-split-note', split ? '缓存输入 ' + fmt(t.cached) + ' · 已知拆分 ' + fmt(t.knownSplitTotal) : '部分渠道未保存输入输出明细');
    label('#date-window', data.from && data.to ? data.from + ' 至 ' + data.to : '暂无可展示的日期范围');
  }
  function renderSources(data) {
    const list = $('#source-list'); clear(list); const sources = data.sources || [];
    const max = Math.max(1, ...sources.map((s) => numeric(s.total)));
    label('#source-count', sources.filter((s) => s.state === 'ready' || numeric(s.total) > 0).length + ' 个可用');
    if (!sources.length) list.append(node('p', publicDashboard ? '当前摘要没有渠道记录。' : '等待渠道扫描。', 'minor'));
    sources.forEach((s) => {
      const row = node('div', undefined, 'source-row'); const swatch = node('i', undefined, 'source-swatch'); swatch.style.background = colors[s.id] || '#7f9bb3';
      const main = node('div', undefined, 'source-main'), title = node('div', undefined, 'source-title');
      const totalLabel = s.total === null || s.total === undefined ? '—' : fmt(s.total);
      title.append(node('b', s.name || name(s.id)), node('span', totalLabel)); main.append(title);
      const bar = node('div', undefined, 'bar'), fill = node('i'); fill.style.width = Math.max(0, Math.min(100, numeric(s.total) / max * 100)) + '%'; fill.style.background = colors[s.id] || '#7f9bb3'; bar.append(fill); main.append(bar);
      main.append(node('div', s.note || (s.state === 'pending' ? '正在扫描，尚无汇总' : '无记录覆盖'), 'source-meta'));
      const descriptions = { ready: '已接入', stale: '上次更新', pending: '读取中', unavailable: '暂无用量' };
      const pillClass = s.state === 'ready' ? 'quality-pill' : 'quality-pill quality-pill--unavailable';
      const quality = node('span', descriptions[s.state] || '暂无用量', pillClass);
      row.append(swatch, main, quality); list.append(row);
    });
    const menu = $('#scope-menu');
    if (!menu) return;
    clear(menu);
    [{ id: '', name: '全部渠道' }, ...sources.map((s) => ({ id: s.id, name: s.name || name(s.id) }))].forEach((s) => {
      const button = node('button', s.name, 'scope-option'); button.type = 'button'; button.dataset.source = s.id; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(s.id === state.source)); menu.append(button);
    });
    label('#scope-button', state.source ? name(state.source) : '全部渠道');
  }
  function formatShare(value, total) {
    if (!Number.isFinite(total) || !Number.isFinite(value) || total <= 0 || value < 0 || value > total) return '';
    const percent = value / total * 100;
    return percent > 0 && percent < 0.1 ? '<0.1%' : percent.toFixed(1) + '%';
  }
  function breakdownItem(label, amount, share) {
    const item = node('div');
    const value = node('dd', amount);
    if (share) value.append(node('span', ' · ' + share, 'effort-share'));
    item.append(node('dt', label), value);
    return item;
  }
  function effortBreakdown({ total, reasoningEfforts = [] }) {
    const recorded = reasoningEfforts.reduce((sum, entry) => sum + entry.total, 0);
    const tokenTotal = numeric(total);
    const unrecorded = Math.max(0, tokenTotal - recorded);
    const list = node('dl', undefined, 'effort-breakdown');
    const entries = unrecorded > 0
      ? [...reasoningEfforts, { effort: '未记录', total: unrecorded }]
      : reasoningEfforts;
    for (const { effort, total: tokens } of entries) {
      list.append(breakdownItem(effort, fmt(tokens), formatShare(tokens, tokenTotal)));
    }
    return list;
  }
  function hasSessionSettings(data) {
    return Boolean(data?.reasoningSettings?.length)
      || (data?.reasoningSettingsSupported === true && Number.isSafeInteger(data.sessions) && data.sessions > 0);
  }
  function settingsBreakdown({ sessions: total, reasoningSettings: settings = [] }) {
    const section = node('div', undefined, 'reasoning-settings');
    const recorded = settings.reduce((sum, entry) => sum + entry.sessions, 0);
    const hasTotal = Number.isSafeInteger(total) && total > 0 && total >= recorded;
    const description = hasTotal
      ? '按当前范围的会话总数计算占比。Token 为会话累计。'
      : '按会话中保存的设置计数。Token 为会话累计。';
    section.append(node('h5', '会话设置'), node('p', description, 'minor'));
    const list = node('dl', undefined, 'effort-breakdown');
    const entries = hasTotal && total > recorded
      ? [...settings, { setting: '未记录', sessions: total - recorded }]
      : settings;
    for (const { setting, sessions } of entries) {
      const label = setting === 'enabled' ? '已开启' : setting === 'disabled' ? '已关闭' : setting;
      list.append(breakdownItem(label, integer(sessions) + ' 个会话', hasTotal ? formatShare(sessions, total) : ''));
    }
    section.append(list);
    return section;
  }
  function appendModel(target, model) {
    const row = node('div', undefined, 'model-row');
    const title = node('div');
    title.append(node('b', model.name || '未标注模型'), node('small', name(model.source)));
    row.append(title, node('span', fmt(model.total)));
    const hasEffort = Boolean(model.reasoningEfforts?.length);
    const hasSettings = hasSessionSettings(model);
    const details = node('details', undefined, 'model-effort');
    details.append(node('summary', !hasEffort && hasSettings ? '查看会话设置' : '查看推理强度'), effortBreakdown(model));
    if (hasSettings) details.append(settingsBreakdown(model));
    row.append(details);
    target.append(row);
  }
  function effortSourceStatus(source) {
    if (source?.state === 'pending') return '读取中';
    if (source?.state === 'unavailable') return '暂无可用记录';
    return '当前范围暂无用量';
  }
  function renderEffortSources(sources) {
    const section = node('div', undefined, 'effort-sources');
    section.append(node('h4', '渠道明细'));
    for (const source of sources) {
      const sourceName = source.name || name(source.id);
      const levelCount = source.reasoningEfforts?.length || 0;
      const hasSettings = hasSessionSettings(source);
      if (levelCount || hasSettings) {
        const details = node('details', undefined, 'effort-source');
        const heading = node('summary');
        const settingsCount = source.reasoningSettings?.length || 0;
        const settingsStatus = settingsCount ? settingsCount + ' 种' : '未记录';
        const status = levelCount ? levelCount + ' 个已记录档位' : '会话设置 · ' + settingsStatus;
        heading.append(node('b', sourceName), node('span', status, 'effort-source-note'));
        details.append(heading);
        if (numeric(source.total) > 0) details.append(effortBreakdown(source));
        if (hasSettings) details.append(settingsBreakdown(source));
        section.append(details);
      } else {
        const row = node('div', undefined, 'effort-source');
        const total = numeric(source.total);
        const status = total > 0
          ? '未记录 · ' + fmt(total) + ' · ' + formatShare(total, total)
          : effortSourceStatus(source);
        row.append(node('b', sourceName), node('span', status, 'effort-source-note'));
        section.append(row);
      }
    }
    return section;
  }
  function renderModels(data) {
    const summary = $('#effort-summary'); clear(summary);
    const total = numeric(data.totals?.total);
    const efforts = data.reasoningEfforts || [];
    const sources = data.sources || [];
    const selected = sources.find(source => source.id === data.focus);
    const scope = selected ? (selected.name || name(selected.id)) + ' · ' : '';
    if (total > 0) {
      const description = efforts.length
        ? '按当前范围的 Token 总量计算占比。'
        : '当前范围的 Token 用量缺少对应的推理强度。';
      summary.append(node('p', scope + description, 'minor'), effortBreakdown({ total, reasoningEfforts: efforts }));
    } else {
      summary.append(node('p', scope + effortSourceStatus(selected) + '。', 'minor'));
    }
    if (hasSessionSettings(selected)) summary.append(settingsBreakdown(selected));
    if (!data.focus && sources.length) summary.append(renderEffortSources(sources));
    const list = $('#model-list'); clear(list);
    const models = (data.models || []).filter(model => numeric(model.total) > 0)
      .sort((a, b) => numeric(b.total) - numeric(a.total));
    const rows = models.slice(0, 7);
    if (!rows.length) list.append(node('p', '当前范围没有可归类的模型用量。', 'minor'));
    rows.forEach(model => appendModel(list, model));
    if (models.length > rows.length) {
      const more = node('details', undefined, 'more-models');
      const remaining = models.slice(rows.length);
      const body = node('div', undefined, 'model-list');
      remaining.forEach(model => appendModel(body, model));
      more.append(node('summary', '其余 ' + remaining.length + ' 个模型'), body);
      list.append(more);
    }
  }
  function renderQuality(data) {
    const list = $('#quality-list'); clear(list); const sources = data.sources || [];
    if (!sources.length) list.append(node('p', '暂无数据源状态。', 'minor'));
    sources.forEach((s) => {
      const kind = s.state === 'ready' ? 'ready' : s.state === 'unavailable' ? 'unavailable' : 'stale';
      const item = node('div', undefined, 'quality-item'), dot = node('i', undefined, 'quality-dot quality-dot--' + kind), details = node('div');
      const range = s.coverageFrom && s.coverageTo ? '覆盖 ' + s.coverageFrom + ' 至 ' + s.coverageTo : '';
      details.append(node('b', s.name || name(s.id)), node('p', [s.note, range].filter(Boolean).join(' · ') || '正在等待扫描结果')); item.append(dot, details); list.append(item);
    });
  }
  function renderLegend(data) {
    const el = $('#chart-legend');
    clear(el);
    const active = data.sources.filter(source => (!state.source || source.id === state.source)
      && (source.total > 0 || source.state === 'ready'));
    for (const source of active) {
      const item = node('span');
      const dot = node('i');
      dot.style.background = colors[source.id];
      item.append(dot, document.createTextNode(source.name || name(source.id)));
      el.append(item);
    }
  }
  function drawDaily(data) {
    const canvas = $('#daily-chart'), rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, ctx = canvas.getContext('2d');
    canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height, R = 10, T = 16, B = 30, rows = data.daily || [];
    const visible = ['codex', 'claude', 'workbuddy'].filter((id) => !state.source || id === state.source);
    const max = Math.max(1, ...rows.map((r) => visible.reduce((sum, id) => sum + numeric(r[id]), 0)));
    const theme = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px Inter, PingFang SC, sans-serif';
    const L = Math.max(44, Math.ceil(ctx.measureText(fmt(max)).width) + 12);
    ctx.fillStyle = theme.getPropertyValue('--muted').trim();
    ctx.strokeStyle = theme.getPropertyValue('--line').trim();
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const y = T + (H - T - B) * i / 3; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.fillText(fmt(max * (1 - i / 3)), 0, y + 4); }
    if (!rows.length) {
      ctx.textAlign = 'center'; ctx.fillText('暂无每日数据', W / 2, H / 2); ctx.textAlign = 'left';
      canvas.onmousemove = canvas.onmouseleave = canvas.onfocus = canvas.onblur = canvas.onkeydown = null;
      $('#chart-tip').hidden = true;
      $('#daily-table').textContent = '';
      return;
    }
    const pw = W - L - R, ph = H - T - B, step = pw / rows.length, bw = Math.min(26, step * .72);
    rows.forEach((r, index) => { let y = T + ph; visible.forEach((id) => { const h = numeric(r[id]) / max * ph; if (!h) return; ctx.fillStyle = colors[id]; ctx.fillRect(L + step * index + (step - bw) / 2, y - h, bw, h); y -= h; }); });
    ctx.textAlign = 'center'; const every = Math.max(1, Math.ceil(rows.length / 5));
    rows.forEach((r, i) => { if (i % every === 0 || i === rows.length - 1) ctx.fillText(String(r.date || '').slice(5).replace('-', '/'), L + step * i + step / 2, H - 9); }); ctx.textAlign = 'left';
    $('#daily-table').textContent = rows.map((r) => r.date + '：' + visible.map((id) => name(id) + ' ' + (r[id] == null ? '无记录覆盖' : fmt(r[id]))).join('，')).join('。');
    const showTip = (index, x, y) => {
      const safeIndex = Math.max(0, Math.min(rows.length - 1, index)), r = rows[safeIndex], tip = $('#chart-tip');
      state.dayIndex = safeIndex; clear(tip); tip.append(node('b', r.date));
      visible.forEach((id) => { tip.append(document.createElement('br')); const value = r[id] === null || r[id] === undefined ? '无记录覆盖' : fmt(r[id]); const line = node('span', '● ' + name(id) + ' ' + value); line.style.color = colors[id]; tip.append(line); });
      tip.hidden = false; tip.style.left = Math.max(4, Math.min(W - 165, x)) + 'px'; tip.style.top = Math.max(4, y) + 'px';
    };
    canvas.onmousemove = (event) => { const x = event.clientX - rect.left, index = Math.max(0, Math.min(rows.length - 1, Math.floor((x - L) / step))); showTip(index, x + 12, event.clientY - rect.top - 54); };
    canvas.onmouseleave = () => { $('#chart-tip').hidden = true; };
    canvas.onfocus = () => showTip(state.dayIndex, L + step * state.dayIndex + 12, 16);
    canvas.onblur = () => { $('#chart-tip').hidden = true; };
    canvas.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : state.dayIndex + (event.key === 'ArrowRight' ? 1 : -1);
      showTip(index, L + step * Math.max(0, Math.min(rows.length - 1, index)) + 12, 16);
    };
  }
  function render(data) {
    state.data = data;
    window.renderWelcome?.(data);
    const renderKey = JSON.stringify([data.generatedAt, data.from, data.to, state.source, data.lifetimeTotal,
      data.hourlySources, data.hourlyTotal, data.hourly, data.reasoningEfforts,
      data.sources.map(source => [source.id, source.state, source.total, source.sessions, source.note,
        source.reasoningEfforts, source.reasoningSettings, source.reasoningSettingsSupported])]);
    if (state.renderKey !== renderKey) {
      renderMetrics(data);
      renderSources(data);
      renderModels(data);
      renderQuality(data);
      renderLegend(data);
      drawDaily(data);
      window.renderInsights?.(data);
      window.renderReport?.(data);
      state.renderKey = renderKey;
    }
    if (publicDashboard) {
      const demo = data.publicMode === 'demo';
      status(demo ? '示例数据' : '我的用量摘要', 'ready');
      label('#last-updated', demo ? '示例数据' : '用量摘要已在当前页面打开');
      return;
    }
    if (data.refreshing || data.complete === false) {
      status('正在整理本机数据', 'loading');
      const p = data.progress;
      notice(p ? '正在同步 ' + name(p.source) + ' 的本机用量。'
        : '正在更新本机用量。', 'warning');
    } else {
      const partial = (data.sources || []).some((s) => s.state === 'unavailable' || s.state === 'pending' || s.state === 'stale');
      status(partial ? '部分渠道可用' : '本机数据已就绪', partial ? 'loading' : 'ready');
      notice(partial ? '部分渠道尚未发现可读记录或仍未完成扫描。图表中“无记录覆盖”不代表零用量。' : '', partial ? 'warning' : '');
    }
    label('#last-updated', data.generatedAt ? '最近更新 ' + new Date(data.generatedAt).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Singapore' }) + '（新加坡时间）' : '扫描尚未完成');
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    if (data.refreshing) state.pollTimer = setTimeout(load, 2000);
  }
  function applyTheme(theme) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const style = getComputedStyle(document.documentElement);
    for (const [source, property] of Object.entries(colorVariables)) {
      colors[source] = style.getPropertyValue(property).trim();
    }
    const button = $('#theme-toggle');
    button.textContent = light ? '深色模式' : '浅色模式';
    button.setAttribute('aria-pressed', String(light));
    state.renderKey = null;
    if (state.data) render(state.data);
  }

  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('compute-dashboard-theme') || 'dark'; } catch {}
  applyTheme(savedTheme);
  $('#theme-toggle').addEventListener('click', () => {
    const selected = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('compute-dashboard-theme', selected); } catch {}
    applyTheme(selected);
  });
  const unitSelect = $('#unit-select');
  unitSelect.value = window.computeUnits.get();
  unitSelect.addEventListener('change', () => {
    window.computeUnits.set(unitSelect.value);
    state.renderKey = null;
    if (state.data) render(state.data);
    if (state.accountData) renderAccount(state.accountData);
  });
  window.addEventListener('resize', () => { if (state.data) drawDaily(state.data); });
  if (publicDashboard) {
    publicDashboard.start(data => {
      state.source = data.focus || '';
      state.dayIndex = 0;
      state.renderKey = null;
      $('#chart-tip').hidden = true;
      render(data);
    });
    return;
  }
  async function load() {
    if (state.request) state.request.abort();
    const controller = new AbortController();
    state.request = controller;
    if (!state.data) status('正在连接数据源', 'loading');
    const query = new URLSearchParams({ range: state.range });
    if (state.source) query.set('source', state.source);
    try {
      const response = await fetch('/api/dashboard?' + query, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (state.request === controller) render(data);
    } catch (error) {
      if (error.name !== 'AbortError' && state.request === controller) {
        status('无法连接本地服务', 'error');
        notice('请双击「打开我的算力看板.command」启动服务，然后刷新页面。', 'error');
      }
    } finally {
      if (state.request === controller) state.request = null;
    }
  }
  async function refresh() {
    const b = $('#refresh'); b.disabled = true; b.textContent = '正在刷新';
    try { const r = await fetch('/api/refresh', { method: 'POST' }); if (!r.ok) throw new Error(); await load(); } catch (_) { notice('刷新请求未能启动。请确认本机服务仍在运行。', 'error'); } finally { b.disabled = false; b.textContent = '刷新本机数据'; }
  }
  function renderAccount(data) {
    const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore', dateStyle: 'short' });
    const localToday = formatter.format(new Date());
    const cutoff = formatter.format(new Date(Date.parse(localToday + 'T00:00:00+08:00') - 29 * 86400000));
    const daily = data.daily || [];
    const recent = daily.filter(row => row.date >= cutoff && row.date <= localToday);
    const total = recent.length ? recent.reduce((sum, row) => sum + numeric(row.total), 0) : null;
    const values = [
      ['账号累计', fmt(data.lifetime)], ['近 30 日', fmt(total)], ['日报条目', integer(daily.length)],
    ];
    const grid = node('div', undefined, 'account-grid');
    for (const [label, value] of values) {
      const item = node('div');
      item.append(node('span', label, 'minor'), node('b', value));
      grid.append(item);
    }
    $('#account-content').replaceChildren(grid, node('p', data.note || 'Codex 官方账号统计'));
  }
  async function account() {
    const button = $('#account-load');
    const content = $('#account-content');
    button.disabled = true;
    button.textContent = '正在读取';
    content.replaceChildren(node('p', '正在读取官方账号汇总。'));
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (!response.ok) throw new Error('暂时无法读取账号汇总。');
      const data = await response.json();
      if (!data.available) throw new Error(data.note || '当前账号不可用。');
      state.accountData = data;
      renderAccount(data);
    } catch (error) {
      state.accountData = null;
      content.replaceChildren(node('p', error.message || '暂时无法读取账号汇总。'));
    } finally {
      button.disabled = false;
      button.textContent = '重新获取账号汇总';
    }
  }
  document.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { state.range = b.dataset.range; document.querySelectorAll('[data-range]').forEach((x) => { const on = x === b; x.classList.toggle('is-selected', on); x.setAttribute('aria-pressed', String(on)); }); load(); }));
  $('#refresh').addEventListener('click', refresh); $('#account-load').addEventListener('click', account);
  const channelButton = $('#scope-button');
  const channelMenu = $('#scope-menu');
  function setChannelMenu(open) {
    channelMenu.hidden = !open;
    channelButton.setAttribute('aria-expanded', String(open));
    if (open) channelMenu.querySelector('[aria-selected="true"]')?.focus();
    else channelButton.focus();
  }
  channelButton.addEventListener('click', () => setChannelMenu(channelMenu.hidden));
  channelMenu.addEventListener('click', event => {
    const option = event.target.closest('[data-source]');
    if (!option) return;
    state.source = option.dataset.source;
    setChannelMenu(false);
    void load();
  });
  channelMenu.addEventListener('keydown', event => {
    const options = Array.from(channelMenu.querySelectorAll('[data-source]'));
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      setChannelMenu(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    options[(index + offset + options.length) % options.length]?.focus();
  });
  load();
})();
