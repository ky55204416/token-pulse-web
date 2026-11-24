(() => {
  const C = { codex: 'var(--cyan)', claude: 'var(--amber)', workbuddy: 'var(--lavender)' };
  const fallback = [
    ['codex', 'Codex'],
    ['claude', 'Claude Code'],
    ['workbuddy', 'Workbuddy'],
    ['cursor', 'Cursor'],
    ['copilot', 'GitHub Copilot'],
    ['windsurf', 'Windsurf'],
    ['cline', 'Cline'],
    ['roo', 'Roo Code'],
    ['continue', 'Continue'],
    ['aider', 'Aider'],
    ['kiro', 'Kiro'],
    ['trae', 'Trae'],
    ['qoder', 'Qoder'],
    ['lingma', '通义灵码'],
    ['codearts', 'CodeArts'],
    ['antigravity', 'Antigravity'],
  ].map(([id, name]) => ({ id, name }));
  const state = { tab: 'structure', calendar: 'week', calendarFocus: null };
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0),
    has = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const fmt = (v) => window.computeUnits?.format?.(n(v)) || n(v).toLocaleString('zh-CN');
  const e = (tag, text, cls) => {
    const x = document.createElement(tag);
    if (text !== undefined) x.textContent = text;
    if (cls) x.className = cls;
    return x;
  };
  const clear = (x) => {
    while (x.firstChild) x.removeChild(x.firstChild);
  };
  const head = (a, b) => {
    const x = e('div', undefined, 'insights-heading');
    x.append(e('h2', a), e('p', b));
    return x;
  };
  const name = (id, d) =>
    [...(d.toolCatalog || []), ...fallback].find((x) => x.id === id)?.name || id || '未知渠道';
  const color = (id) => C[id] || 'var(--cyan)';
  const percentShare = (amount, total) => {
    const percent = (amount / total) * 100;
    return percent > 0 && percent < 0.1 ? '<0.1%' : `${percent.toFixed(1)}%`;
  };
  const sources = (d) =>
    (d.sources || []).filter((x) => (!d.focus || x.id === d.focus) && n(x.total) > 0);
  const daily = (d) =>
    (d.daily || [])
      .filter((x) => x.date && has(x.total))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  function ring(d) {
    const live = sources(d),
      total = live.reduce((s, x) => s + n(x.total), 0),
      sourceById = new Map((d.sources || []).map((x) => [x.id, x]));
    const base = Array.isArray(d.toolCatalog) && d.toolCatalog.length ? d.toolCatalog : fallback,
      seen = new Set(base.map((x) => x.id));
    const tools = [
      ...base,
      ...(d.sources || [])
        .filter((x) => !seen.has(x.id))
        .map((x) => ({ id: x.id, name: x.name || x.id })),
    ];
    const isConnected = (id) => ['ready', 'stale'].includes(sourceById.get(id)?.state);
    const connected = tools.filter((x) => isConnected(x.id)).length;
    const box = e('section', undefined, 'tool-ring-card');
    box.append(head('工具生态与 Token 占比', '各渠道用量占当前筛选范围的比例。'));
    const body = e('div', undefined, 'tool-ring-body'),
      chart = e('div', undefined, 'tool-ring');
    let edge = 0;
    const stops = live.map((x) => {
      const start = edge;
      edge += total ? (n(x.total) / total) * 100 : 0;
      return `${color(x.id)} ${start}% ${edge}%`;
    });
    chart.style.background = stops.length ? `conic-gradient(${stops.join(',')})` : 'var(--line)';
    const centre = e('div', undefined, 'tool-ring-centre');
    centre.append(e('strong', fmt(total)), e('span', '筛选范围内 Token'));
    chart.append(centre);
    body.append(chart);
    const list = e('div', undefined, 'ring-live-list');
    const controls = new Map();
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', '在旭日图中查看渠道');
    if (!live.length) list.append(e('p', '当前筛选没有可绘制的已接入用量。', 'insight-empty'));
    live.forEach((x) => {
      const row = e('button', undefined, 'ring-live-row'),
        dot = e('i');
      row.type = 'button';
      row.title = `在旭日图中查看 ${x.name || name(x.id, d)}`;
      dot.style.background = color(x.id);
      row.append(
        dot,
        e('span', x.name || name(x.id, d)),
        e('b', percentShare(n(x.total), total))
      );
      list.append(row);
      controls.set(x.id, row);
    });
    body.append(list);
    box.append(body);
    const catalog = e('div', undefined, 'tool-catalog');
    tools.forEach((tool) => {
      const active = isConnected(tool.id),
        row = e('div', undefined, active ? 'tool-status is-connected' : 'tool-status'),
        dot = e('i');
      if (active) dot.style.background = color(tool.id);
      row.append(dot, e('span', tool.name), e('b', active ? '已接入' : '未接入'));
      catalog.append(row);
    });
    const availability = e('details', undefined, 'composition-availability');
    availability.append(e('summary', `工具接入状态 · ${connected}/${tools.length}`), catalog);
    return { box, controls, availability };
  }

  const fullCircle = Math.PI * 2;
  const sunburstRings = {
    channel: { inner: 47, outer: 94 },
    model: { inner: 99, outer: 146 },
  };

  function sunburstSegments(d) {
    const live = sources(d);
    const total = live.reduce((sum, source) => sum + n(source.total), 0);
    let channelOffset = 0;
    const channels = live.map((source, index) => {
      const amount = n(source.total);
      const start = (channelOffset / total) * fullCircle;
      channelOffset += amount;
      const end = index === live.length - 1 ? fullCircle : (channelOffset / total) * fullCircle;
      const channel = {
        kind: 'channel', id: source.id, name: source.name || name(source.id, d),
        total: amount, start, end,
      };
      const models = (d.models || [])
        .filter((model) => model.source === source.id && n(model.total) > 0)
        .map((model) => ({ name: model.name || '未标注模型', total: n(model.total) }));
      const missing = amount - models.reduce((sum, model) => sum + model.total, 0);
      if (missing > 0) {
        const unknown = models.find((model) => model.name === '未标注模型');
        if (unknown) unknown.total += missing;
        else models.push({ name: '未标注模型', total: missing });
      }
      let modelOffset = 0;
      channel.models = (missing < 0 ? [] : models).map((model, i) => {
        const modelStart = start + (modelOffset / total) * fullCircle;
        modelOffset += model.total;
        return {
          ...model, channel, kind: 'model', start: modelStart,
          end: i === models.length - 1 ? end : start + (modelOffset / total) * fullCircle,
          shade: [0.88, 0.62, 0.77, 0.48][i % 4],
        };
      });
      return channel;
    });
    return { channels, total };
  }

  function sunburst(d, controls) {
    const box = e('section', undefined, 'sunburst-card');
    box.id = 'model-sunburst';
    box.append(head('AI 智能体与模型嵌套旭日图', '内圈是渠道，外圈是各渠道使用的模型。'));
    const { channels, total } = sunburstSegments(d);
    if (!total) {
      box.append(e('p', '当前筛选暂无渠道与模型用量。', 'insight-empty'));
      return box;
    }

    const stage = e('div', undefined, 'sunburst-stage');
    const canvas = e('canvas');
    const size = 304;
    const midpoint = size / 2;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * ratio);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '双层 Token 用量图。可通过渠道图例和模型明细查看数值。');
    stage.append(canvas);
    const description = e('p', undefined, 'sunburst-readout');
    const descriptionName = e('b');
    const descriptionAmount = e('span');
    description.append(descriptionName, descriptionAmount);
    const announcement = e('span', '', 'sr-only');
    announcement.setAttribute('role', 'status');
    const reset = e('button', '返回总览', 'sunburst-reset');
    reset.type = 'button';
    reset.hidden = true;
    const readoutRow = e('div', undefined, 'sunburst-readout-row');
    readoutRow.append(description, reset);
    const details = e('details', undefined, 'sunburst-details');
    const detailsHeading = e('summary');
    const modelList = e('div', undefined, 'sunburst-models');
    details.append(detailsHeading, modelList);
    box.append(stage, readoutRow, details, announcement);

    const context = canvas.getContext('2d');
    const theme = getComputedStyle(document.documentElement);
    const palettes = new Map(channels.map((item) => [
      item.id, theme.getPropertyValue(color(item.id).slice(4, -1)).trim(),
    ]));
    const models = channels.flatMap((item) => item.models);
    const modelButtons = new Map();
    let selected = null;
    let listedChannel = null;
    let focusedChannel = null;
    let hovered = null;
    const projectAngle = (angle) => focusedChannel
      ? ((angle - focusedChannel.start) / (focusedChannel.end - focusedChannel.start)) * fullCircle
      : angle;

    function stroke(item, amount, alpha, fill) {
      const ring = sunburstRings[item.kind];
      const radius = (ring.inner + ring.outer) / 2;
      if (item.end <= item.start) return;
      context.beginPath();
      context.arc(midpoint, midpoint, radius, projectAngle(item.start) - Math.PI / 2, projectAngle(item.end) - Math.PI / 2);
      context.strokeStyle = fill || palettes.get(item.channel?.id || item.id);
      context.globalAlpha = alpha;
      context.lineWidth = amount;
      context.stroke();
    }

    function drawLabel(segment) {
      const { inner, outer } = sunburstRings[segment.kind];
      const radius = (inner + outer) / 2;
      const start = projectAngle(segment.start), end = projectAngle(segment.end);
      const span = end - start;
      const midpointAngle = (start + end) / 2;
      context.font = `${segment.kind === 'channel' ? 700 : 550} 12px system-ui, sans-serif`;
      if (context.measureText(segment.name).width > Math.min(106, radius * span * 0.74)) return;
      context.save();
      context.translate(midpoint + Math.sin(midpointAngle) * radius, midpoint - Math.cos(midpointAngle) * radius);
      const upsideDown = midpointAngle > Math.PI / 2 && midpointAngle < 1.5 * Math.PI;
      context.rotate(midpointAngle - (upsideDown ? Math.PI : 0));
      context.globalAlpha = 1;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = theme.getPropertyValue('--text').trim();
      context.strokeStyle = theme.getPropertyValue('--surface').trim();
      context.lineWidth = 2.5;
      context.lineJoin = 'round';
      context.strokeText(segment.name, 0, 0);
      context.fillText(segment.name, 0, 0);
      context.restore();
    }

    function drawSeparators(segments) {
      if (segments.length < 2) return;
      const { inner, outer } = sunburstRings[segments[0].kind];
      context.beginPath();
      for (const [index, segment] of segments.entries()) {
        const previous = segments.at(index - 1);
        const start = projectAngle(segment.start);
        if (Math.min(projectAngle(segment.end) - start, projectAngle(previous.end) - projectAngle(previous.start)) < 0.025) continue;
        const x = Math.sin(start), y = -Math.cos(start);
        context.moveTo(midpoint + x * inner, midpoint + y * inner);
        context.lineTo(midpoint + x * outer, midpoint + y * outer);
      }
      context.globalAlpha = 1;
      context.strokeStyle = theme.getPropertyValue('--surface').trim();
      context.lineWidth = 1.15;
      context.stroke();
    }

    function preview(item) {
      if (context) {
        const scale = canvas.width / size;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.clearRect(0, 0, size, size);
        const inner = focusedChannel ? [focusedChannel] : channels;
        const outer = focusedChannel ? focusedChannel.models : models;
        const segments = [...inner, ...outer];
        for (const segment of segments) {
          const { inner, outer } = sunburstRings[segment.kind];
          const thickness = outer - inner;
          const active = segment === item || segment === item?.channel || segment.channel === item;
          stroke(segment, thickness, item && !active ? (segment.shade || 1) * 0.6 : segment.shade || 1);
          if (segment === item && item.kind === 'model' && projectAngle(segment.end) - projectAngle(segment.start) > 0.025) {
            stroke(segment, 2, 1, theme.getPropertyValue('--text').trim());
          }
        }
        drawSeparators(inner);
        drawSeparators(outer);
        for (const segment of segments) {
          if (!item || segment === item || segment === item.channel || segment.channel === item) drawLabel(segment);
        }
      }
      descriptionName.textContent = item?.channel ? `${item.channel.name} / ${item.name}` : item?.name || '当前范围';
      const amount = item?.total ?? total;
      const relative = item?.channel ? ` · 渠道内 ${percentShare(amount, item.channel.total)}` : '';
      descriptionAmount.textContent = `${fmt(amount)} Token · 整体 ${percentShare(amount, total)}${relative}`;
    }

    function choose(item) {
      selected = item;
      const channel = item?.channel || item || channels[0];
      if (channel !== listedChannel) {
        listedChannel = channel;
        clear(modelList);
        modelButtons.clear();
        detailsHeading.textContent = `${channel.name} 模型明细 · ${channel.models.length} 个`;
        if (!channel.models.length) modelList.append(e('p', '当前模型用量与渠道汇总不一致。', 'chart-caption'));
        for (const model of channel.models) {
          const button = e('button', undefined, 'sunburst-option');
          button.type = 'button';
          button.append(e('span', model.name), e('b', `${fmt(model.total)} · ${percentShare(model.total, channel.total)}`));
          button.addEventListener('click', () => choose(model));
          modelButtons.set(model, button);
          modelList.append(button);
        }
      }
      for (const [model, button] of modelButtons) {
        button.setAttribute('aria-pressed', String(model === item));
      }
      preview(selected);
      announcement.textContent = `${descriptionName.textContent}，${descriptionAmount.textContent}`;
    }

    function focus(channel) {
      focusedChannel = channel === focusedChannel || channels.length === 1 ? null : channel;
      hovered = null;
      reset.hidden = !focusedChannel;
      for (const [id, button] of controls) {
        button.setAttribute('aria-pressed', String(id === focusedChannel?.id));
      }
      choose(focusedChannel);
    }

    for (const channel of channels) {
      const button = controls.get(channel.id);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => channels.length === 1 ? choose(channel) : focus(channel));
    }
    reset.addEventListener('click', () => {
      const button = controls.get(focusedChannel.id);
      focus(null);
      button.focus({ preventScroll: true });
    });

    function hit(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = ((event.clientX - rect.left) * size) / rect.width - midpoint;
      const y = ((event.clientY - rect.top) * size) / rect.height - midpoint;
      const radius = Math.hypot(x, y);
      const angle = (Math.atan2(y, x) + Math.PI / 2 + fullCircle) % fullCircle;
      const inner = focusedChannel ? [focusedChannel] : channels;
      const outer = focusedChannel ? focusedChannel.models : models;
      for (const [kind, segments] of [['channel', inner], ['model', outer]]) {
        const { inner, outer } = sunburstRings[kind];
        if (radius >= inner && radius <= outer) {
          return segments.find((segment) => angle >= projectAngle(segment.start) && angle < projectAngle(segment.end)) || null;
        }
      }
      return null;
    }
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const next = hit(event);
      if (next === hovered) return;
      hovered = next;
      preview(hovered || selected);
    });
    canvas.addEventListener('pointerleave', () => {
      hovered = null;
      preview(selected);
    });
    canvas.addEventListener('click', (event) => {
      const item = hit(event);
      if (item?.kind === 'channel' && channels.length > 1) focus(item);
      else if (item) choose(item);
      else if (focusedChannel) focus(null);
      else choose(null);
    });
    choose(null);
    return box;
  }

  function line(d) {
    const rows = daily(d),
      box = e('article', undefined, 'insight-card cumulative-card');
    box.append(head('时序累计跃升', `按有效日期累计；覆盖 ${d.from || '—'} 至 ${d.to || '—'}。`));
    if (!rows.length) {
      box.append(e('p', '当前筛选没有可累计的每日记录。', 'insight-empty'));
      return box;
    }
    let run = 0;
    const pts = rows.map((x) => ({
        date: x.date,
        total: n(x.total),
        sum: (run += n(x.total)),
        time: Date.parse(`${x.date}T00:00:00Z`),
      })),
      max = Math.max(1, run),
      W = 680,
      H = 230,
      L = 48,
      R = 14,
      T = 18,
      B = 34,
      first = pts[0].time,
      last = pts.at(-1).time,
      x = (i) =>
        first === last
          ? (L + W - R) / 2
          : L + ((pts[i].time - first) * (W - L - R)) / (last - first),
      y = (v) => T + (1 - v / max) * (H - T - B);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '累计 Token 曲线。可用左右方向键查看各日期。');
    const add = (tag, attrs, text) => {
      const z = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs || {}).forEach(([k, v]) => z.setAttribute(k, v));
      if (text) z.textContent = text;
      svg.append(z);
      return z;
    };
    [0, 0.5, 1].forEach((q) => {
      const yy = y(max * q);
      add('line', { x1: L, y1: yy, x2: W - R, y2: yy, class: 'trend-grid' });
      add(
        'text',
        { x: L - 7, y: yy + 4, 'text-anchor': 'end', class: 'trend-label' },
        fmt(max * q)
      );
    });
    const path = pts
        .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.sum).toFixed(1)}`)
        .join(' '),
      area = `${path} L${x(pts.length - 1)},${H - B} L${x(0)},${H - B} Z`;
    add('path', { d: area, class: 'trend-area' });
    add('path', { d: path, class: 'trend-line' });
    [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])].forEach((i) => {
      const p = pts[i],
        dot = add('circle', { cx: x(i), cy: y(p.sum), r: 3.5, class: 'trend-dot' }),
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${p.date}：累计 ${fmt(p.sum)}，当日 ${fmt(p.total)}`;
      dot.append(title);
      add(
        'text',
        {
          x: x(i),
          y: H - 10,
          'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle',
          class: 'trend-label',
        },
        p.date.slice(5).replace('-', '/')
      );
    });
    const frame = e('div', undefined, 'trend-frame');
    frame.append(svg);
    const marker = add('circle', { r: 5, class: 'trend-dot' });
    const readout = e('p', '', 'chart-caption trend-readout');
    readout.setAttribute('aria-live', 'polite');
    let selected = pts.length - 1;
    function select(index) {
      selected = Math.max(0, Math.min(pts.length - 1, index));
      const point = pts[selected];
      marker.setAttribute('cx', x(selected));
      marker.setAttribute('cy', y(point.sum));
      readout.textContent = `${point.date} · 当日 ${fmt(point.total)} · 累计 ${fmt(point.sum)} Token`;
    }
    const inspect = (event) => {
      const transform = svg.getScreenCTM();
      if (!transform) return;
      const horizontal = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        transform.inverse()
      ).x;
      const nearest = pts.reduce(
        (best, _, index) =>
          Math.abs(x(index) - horizontal) < Math.abs(x(best) - horizontal) ? index : best,
        0
      );
      if (nearest !== selected) select(nearest);
    };
    svg.addEventListener('pointermove', inspect);
    svg.addEventListener('pointerdown', inspect);
    svg.addEventListener('keydown', (event) => {
      const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (!offset) return;
      event.preventDefault();
      select(selected + offset);
    });
    select(selected);
    box.append(frame, readout);
    return box;
  }

  function burn(d) {
    const box = e('article', undefined, 'insight-card monthly-card');
    box.append(head('月度燃烧速率', '柱高为当月已观测到的实际 Token，不填补未记录日期。'));
    const map = new Map();
    daily(d).forEach((x) => {
      const k = x.date.slice(0, 7);
      map.set(k, (map.get(k) || 0) + n(x.total));
    });
    const vals = [...map.entries()];
    if (!vals.length) {
      box.append(e('p', '当前筛选没有可聚合的每日记录。', 'insight-empty'));
      return box;
    }
    const max = Math.max(...vals.map((x) => x[1])),
      bars = e('div', undefined, 'burn-bars');
    const readout = e(
      'p',
      `共 ${vals.length} 个有记录月份 · 峰值 ${fmt(max)} Token`,
      'chart-caption'
    );
    readout.setAttribute('aria-live', 'polite');
    vals.forEach(([month, v]) => {
      const col = e('div', undefined, 'burn-column'),
        rail = e('div', undefined, 'burn-rail'),
        bar = e('button', '', 'burn-bar');
      bar.type = 'button';
      bar.style.height = `${max > 0 ? (v / max) * 100 : 0}%`;
      bar.title = bar.ariaLabel = `${month}：${fmt(v)}`;
      bar.addEventListener('click', () => {
        readout.textContent = `${month} · ${fmt(v)} Token`;
      });
      rail.append(bar);
      col.append(e('b', fmt(v)), rail, e('span', month.slice(2).replace('-', '/')));
      bars.append(col);
    });
    box.append(bars, readout);
    return box;
  }

  function io(d) {
    const t = d.totals || {},
      input = has(t.splitInput) ? n(t.splitInput) : null,
      output = has(t.splitOutput) ? n(t.splitOutput) : null,
      cached = has(t.splitCached) ? n(t.splitCached) : 0,
      box = e('section', undefined, 'io-card');
    box.append(head('真实输入 / 输出比例', '基于同时记录了输入与输出的用量。'));
    if (input === null || output === null) {
      box.append(e('p', '当前筛选尚无可配对的输入输出字段。', 'insight-empty'));
      return box;
    }
    const fresh = Math.max(0, input - cached),
      all = Math.max(1, input + output),
      ratio = output ? input / output : null,
      visual = e('div', undefined, 'io-visual'),
      ratioEl = e('div', undefined, 'io-ratio');
    ratioEl.append(
      e('strong', ratio === null ? '仅输入' : `${ratio.toFixed(2)} : 1`),
      e('span', '输入 : 输出')
    );
    const parts = has(t.splitCached)
      ? [
          ['已记录缓存输入', cached, 'var(--lavender)'],
          ['其余输入', fresh, 'var(--cyan)'],
        ]
      : [['输入', input, 'var(--cyan)']];
    const bars = e('div', undefined, 'io-bars');
    for (const [label, amount, sections] of [
      ['输入', input, parts], ['输出', output, [['输出', output, 'var(--amber)']]],
    ]) {
      const row = e('div', undefined, 'io-bar-row');
      const track = e('div', undefined, 'io-stack');
      track.setAttribute('aria-hidden', 'true');
      for (const [part, value, color] of sections) {
        const fill = e('i');
        fill.style.width = `${(value / all) * 100}%`;
        fill.style.background = color;
        fill.title = `${part} ${fmt(value)}`;
        track.append(fill);
      }
      row.append(e('b', label), track, e('span', `${fmt(amount)} Token（${percentShare(amount, all)}）`));
      bars.append(row);
    }
    visual.append(ratioEl, bars);
    const list = e('div', undefined, 'io-list');
    parts.forEach(([label, v, c]) => {
      const row = e('span'),
        dot = e('i');
      dot.style.background = c;
      row.append(dot, document.createTextNode(`${label} ${fmt(v)}`));
      list.append(row);
    });
    const coverage = has(t.knownSplitTotal) ? n(t.knownSplitTotal) : input + output;
    box.append(visual);
    if (has(t.splitCached)) box.append(list);
    box.append(
      e(
        'p',
        `覆盖 ${fmt(coverage)} Token`,
        'chart-caption'
      )
    );
    return box;
  }

  function hierarchy(d) {
    const box = e('article', undefined, 'insight-card');
    box.append(head('渠道与模型', '模型用量归入对应的数据渠道。'));
    const all = (d.models || []).filter((x) => n(x.total) > 0),
      max = Math.max(1, ...all.map((x) => n(x.total))),
      g = new Map();
    all.forEach((x) => g.set(x.source, [...(g.get(x.source) || []), x]));
    if (!g.size) box.append(e('p', '当前筛选没有可归类的模型记录。', 'insight-empty'));
    g.forEach((models, source) => {
      const group = e('div', undefined, 'model-group');
      group.append(e('h3', name(source, d)));
      models
        .sort((a, b) => n(b.total) - n(a.total))
        .slice(0, 5)
        .forEach((x) => {
          const row = e('div', undefined, 'nested-row'),
            bar = e('div', undefined, 'nested-bar'),
            fill = e('i');
          fill.style.width = `${(n(x.total) / max) * 100}%`;
          fill.style.background = color(source);
          bar.append(fill);
          row.append(e('span', x.name || '未标注模型'), bar, e('b', fmt(x.total)));
          group.append(row);
        });
      box.append(group);
    });
    return box;
  }
  function radar(d) {
    const box = e('article', undefined, 'insight-card radar-card');
    box.append(head('六维使用轮廓', '相对观察上限的结构轮廓，不代表能力评级。'));
    const vals = [
        ['总量', n(d.totals?.total), 1e9],
        ['活跃天数', n(d.totals?.activeDays), 90],
        ['会话数', n(d.totals?.sessions), 1000],
        ['输出', n(d.totals?.output), 1e8],
        ['模型数', new Set((d.models || []).map((x) => x.name)).size, 20],
        ['渠道数', sources(d).length, 8],
      ],
      W = 300,
      H = 230,
      cx = 150,
      cy = 112,
      r = 72,
      pt = (i, s) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        return [cx + Math.cos(a) * r * s, cy + Math.sin(a) * r * s];
      },
      score = (x) => Math.min(1, Math.log1p(x[1]) / Math.log1p(x[2])),
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const add = (tag, a, text) => {
      const z = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(a || {}).forEach(([k, v]) => z.setAttribute(k, v));
      if (text) z.textContent = text;
      svg.append(z);
    };
    [0.25, 0.5, 0.75, 1].forEach((s) =>
      add('polygon', {
        points: vals.map((_, i) => pt(i, s).join(',')).join(' '),
        class: 'radar-grid',
      })
    );
    vals.forEach((v, i) => {
      const p = pt(i, 1),
        l = pt(i, 1.28);
      add('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'radar-grid' });
      add('text', { x: l[0], y: l[1] + 4, 'text-anchor': 'middle', class: 'radar-label' }, v[0]);
    });
    add('polygon', {
      points: vals.map((v, i) => pt(i, score(v)).join(',')).join(' '),
      class: 'radar-shape',
    });
    box.append(svg);
    return box;
  }
  function activity(d) {
    const box = e('article', undefined, 'insight-card');
    box.append(head('活跃时段', '只汇总保留可靠时间戳的本机记录。'));
    const all = d.hourly || [];
    if (!all.some((x) => n(x.total) > 0)) {
      box.append(e('p', '当前范围暂无按小时记录的用量。', 'insight-empty'));
      return box;
    }
    const max = Math.max(...all.map((x) => n(x.total))),
      bars = e('div', undefined, 'hour-bars');
    all.slice(0, 24).forEach((x) => {
      const col = e('div', undefined, 'hour-column'),
        bar = e('i');
      bar.style.height = `${(n(x.total) / max) * 100}%`;
      bar.title = `${String(x.hour).padStart(2, '0')}:00 ${fmt(x.total)}`;
      col.append(bar);
      if (n(x.hour) % 3 === 0) col.append(e('span', String(x.hour).padStart(2, '0')));
      bars.append(col);
    });
    box.append(bars);
    return box;
  }
  function tabs(d) {
    const nav = e('div', undefined, 'insight-tabs');
    [
      ['structure', '渠道与模型'],
      ...(d.publicMode ? [] : [['rhythm', '活跃节律']]),
      ['calendar', '活动日历'],
    ].forEach(([id, label]) => {
      const b = e('button', label, id === state.tab ? 'is-active' : '');
      b.type = 'button';
      b.dataset.insightTab = id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(id === state.tab));
      nav.append(b);
    });
    return nav;
  }
  function root(d) {
    const r = e('section', undefined, 'advanced-insights');
    r.setAttribute('aria-label', '算力分析模块');
    r.append(head('多维使用分析', d.publicMode ? '图表展示当前摘要的日期范围和渠道。' : '核心图表默认同时呈现，并随日期范围和渠道筛选更新。'));
    const core = e('div', undefined, 'core-dashboard');
    const composition = e('section', undefined, 'insight-card composition-card');
    composition.setAttribute('aria-label', '渠道与模型用量分布');
    const pair = e('div', undefined, 'composition-pair');
    const { box, controls, availability } = ring(d);
    pair.append(box, sunburst(d, controls));
    composition.append(pair, io(d), availability);
    core.append(composition, line(d), burn(d));
    r.append(core, e('h3', '进一步查看', 'insights-subtitle'), tabs(d));
    const detail = e('div', undefined, 'insight-pane');
    if (state.tab === 'structure') {
      const grid = e('div', undefined, 'secondary-grid');
      grid.append(hierarchy(d), radar(d));
      detail.append(grid);
    } else detail.append(state.tab === 'rhythm' ? activity(d) : calendar(d));
    r.append(detail);
    return r;
  }
  function calendar(d) {
    const box = e('div', undefined, 'calendar-block'),
      h = head('活动日历', '颜色代表每日实际汇总 Token，空格表示没有记录覆盖。'),
      c = e('div', undefined, 'calendar-controls');
    [
      ['week', '连续周视图'],
      ['month', '月度视图'],
    ].forEach(([id, label]) => {
      const b = e('button', label, id === state.calendar ? 'is-active' : '');
      b.type = 'button';
      b.dataset.calendarView = id;
      b.setAttribute('aria-pressed', String(id === state.calendar));
      c.append(b);
    });
    h.append(c);
    box.append(h);
    const all = d.daily || [],
      by = new Map(all.map((x) => [x.date, x])),
      max = Math.max(1, ...all.map((x) => n(x.total))),
      cell = (key) => {
        const x = by.get(key) || { total: null },
          ok = has(x.total),
          b = e('button', '', ok ? 'heat-cell' : 'heat-cell heat-cell--unknown');
        b.type = 'button';
        b.dataset.date = key;
        b.disabled = !ok;
        b.style.setProperty(
          '--heat',
          ok ? Math.max(0.12, Math.min(1, Math.sqrt(n(x.total) / max))) : 0
        );
        b.title = b.ariaLabel = `${key}，${ok ? fmt(x.total) : '无记录覆盖'}`;
        b.setAttribute('aria-pressed', String(state.calendarFocus === key));
        return b;
      },
      labels = (g) =>
        ['日', '一', '二', '三', '四', '五', '六'].forEach((x) =>
          g.append(e('span', x, 'weekday'))
        );
    let activeDays = 0;
    let streak = 0;
    let longestStreak = 0;
    let peak = null;
    for (const day of all) {
      if (n(day.total) > 0) {
        activeDays++;
        longestStreak = Math.max(longestStreak, ++streak);
        if (!peak || day.total > peak.total) peak = day;
      } else {
        streak = 0;
      }
    }
    box.append(
      e(
        'p',
        `活跃 ${activeDays} 天 · 最长连续 ${longestStreak} 天 · 单日峰值 ${peak ? fmt(peak.total) : '—'}`,
        'calendar-stats'
      )
    );
    if (state.calendar === 'week') {
      const g = e('div', undefined, 'heatmap heatmap--week');
      labels(g);
      if (all.length) {
        const a = new Date(`${all[0].date}T00:00:00Z`),
          z = new Date(`${all.at(-1).date}T00:00:00Z`);
        a.setUTCDate(a.getUTCDate() - a.getUTCDay());
        z.setUTCDate(z.getUTCDate() + 6 - z.getUTCDay());
        for (let q = a; q <= z; q.setUTCDate(q.getUTCDate() + 1))
          g.append(cell(q.toISOString().slice(0, 10)));
      }
      box.append(g);
    } else {
      const wrap = e('div', undefined, 'month-calendar-grid');
      [...new Set(all.map((x) => x.date.slice(0, 7)))].forEach((month) => {
        const s = e('section', undefined, 'calendar-month'),
          g = e('div', undefined, 'month-cells'),
          first = new Date(`${month}-01T00:00:00Z`),
          days = new Date(
            Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
          ).getUTCDate();
        s.append(e('h3', month));
        labels(g);
        for (let i = 0; i < first.getUTCDay(); i++) g.append(e('i', '', 'heat-spacer'));
        for (let i = 1; i <= days; i++) g.append(cell(`${month}-${String(i).padStart(2, '0')}`));
        s.append(g);
        wrap.append(s);
      });
      box.append(wrap);
    }
    const focus = by.get(state.calendarFocus);
    if (focus) {
      const detail = e('div', undefined, 'calendar-detail');
      detail.append(e('b', `${focus.date} · ${fmt(focus.total)}`));
      const vals = e('span');
      (d.sources || [])
        .filter((s) => !d.focus || s.id === d.focus)
        .forEach((s, i) => {
          if (i) vals.append(document.createTextNode(' · '));
          vals.append(
            document.createTextNode(`${name(s.id, d)} ${has(focus[s.id]) ? fmt(focus[s.id]) : '—'}`)
          );
        });
      detail.append(vals);
      box.append(detail);
    }
    return box;
  }
  window.renderInsights = (d) => {
    const m = document.querySelector('#advanced-insights');
    if (!m) return;
    clear(m);
    m.append(root(d));
    m.querySelectorAll('[data-insight-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        state.tab = b.dataset.insightTab;
        window.renderInsights(d);
      })
    );
    m.querySelectorAll('[data-calendar-view]').forEach((b) =>
      b.addEventListener('click', () => {
        state.calendar = b.dataset.calendarView;
        window.renderInsights(d);
        m.querySelector(`[data-calendar-view="${state.calendar}"]`)?.focus();
      })
    );
    m.querySelectorAll('.heat-cell:not(.heat-cell--unknown)').forEach((b) =>
      b.addEventListener('click', () => {
        state.calendarFocus = b.dataset.date;
        window.renderInsights(d);
        m.querySelector(`.heat-cell[data-date="${state.calendarFocus}"]`)?.focus({
          preventScroll: true,
        });
      })
    );
  };
})();
