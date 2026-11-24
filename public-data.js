(() => {
  const channels = { codex: 'Codex', claude: 'Claude Code', workbuddy: 'Workbuddy' };
  const levels = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'ultra', 'max'];
  const dayMs = 86400000;
  const maxDays = 3660;
  const maxBytes = 5 * 1024 * 1024;

  function requireValue(valid) {
    if (!valid) throw new Error('无法识别这份文件。请选择智脉导出的摘要 JSON。');
  }

  function record(value) {
    requireValue(value !== null && typeof value === 'object' && !Array.isArray(value));
    return value;
  }

  function list(value, limit) {
    requireValue(Array.isArray(value) && value.length <= limit);
    return value;
  }

  function count(value) {
    requireValue(Number.isSafeInteger(value) && value >= 0);
    return value;
  }

  function optionalCount(value) {
    return value == null ? null : count(value);
  }

  function date(value) {
    if (value == null) return null;
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
    const millis = Date.parse(value + 'T00:00:00Z');
    requireValue(Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === value);
    return value;
  }

  function channel(id) {
    requireValue(typeof id === 'string' && Object.hasOwn(channels, id));
    return id;
  }

  function unique(key, seen) {
    requireValue(!seen.has(key));
    seen.add(key);
  }

  function breakdown(value, field, amountField, allowed) {
    const seen = new Set();
    return list(value ?? [], allowed.length).map(entry => {
      record(entry);
      requireValue(allowed.includes(entry[field]));
      unique(entry[field], seen);
      return { [field]: entry[field], [amountField]: count(entry[amountField]) };
    });
  }

  function reasoning(row) {
    return {
      reasoningEfforts: breakdown(row.reasoningEfforts, 'effort', 'total', levels),
      reasoningSettings: breakdown(row.reasoningSettings, 'setting', 'sessions', [...levels, 'enabled', 'disabled']),
      reasoningSettingsSupported: row.reasoningSettingsSupported === true,
    };
  }

  function parseSummary(text) {
    requireValue(typeof text === 'string' && text.length <= maxBytes);
    let summary;
    try {
      summary = record(JSON.parse(text.replace(/^\uFEFF/, '')));
    } catch {
      requireValue(false);
    }
    requireValue(summary.title === '我的算力看板摘要');
    const range = record(summary.range);
    const from = date(range.from);
    const to = date(range.to);
    requireValue(from === null ? to === null : to !== null && from <= to && Date.parse(to) - Date.parse(from) < maxDays * dayMs);
    const focus = summary.focus == null ? null : channel(summary.focus);

    const rawTotals = record(summary.totals);
    const totals = { total: count(rawTotals.total) };
    for (const key of ['input', 'cached', 'output', 'splitInput', 'splitOutput', 'splitCached',
      'knownSplitTotal', 'measuredTotal', 'estimatedTotal', 'sessions', 'activeDays']) {
      totals[key] = optionalCount(rawTotals[key]);
    }

    const seenChannels = new Set();
    const sources = list(summary.sources, Object.keys(channels).length).map(source => {
      record(source);
      const id = channel(source.id);
      requireValue(!focus || focus === id);
      unique(id, seenChannels);
      const quality = ['measured', 'mixed', 'estimated', 'unavailable'].includes(source.quality)
        ? source.quality : 'unavailable';
      const total = count(source.total);
      const coverageFrom = date(source.coverageFrom);
      const coverageTo = date(source.coverageTo);
      requireValue(coverageFrom === null ? coverageTo === null : coverageTo !== null && coverageFrom <= coverageTo);
      const state = total > 0 || quality !== 'unavailable' ? 'ready' : 'unavailable';
      return {
        id, name: channels[id], state, quality, total, coverageFrom, coverageTo,
        note: state === 'ready' ? '摘要中的渠道统计' : '摘要中暂无可用记录',
        input: optionalCount(source.input), output: optionalCount(source.output), cached: optionalCount(source.cached),
        sessions: optionalCount(source.sessions), activeDays: optionalCount(source.activeDays),
        ...reasoning(source),
      };
    });
    requireValue(!focus || seenChannels.has(focus));

    const days = new Set();
    const daily = list(summary.daily, maxDays).map(row => {
      record(row);
      const day = date(row.date);
      requireValue(day && from && day >= from && day <= to);
      unique(day, days);
      const result = { date: day, total: optionalCount(row.total) };
      for (const id of Object.keys(channels)) {
        const amount = optionalCount(row[id]);
        requireValue(seenChannels.has(id) || amount === null);
        result[id] = amount;
      }
      return result;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const seenModels = new Set();
    const models = list(summary.models, 500).map(model => {
      record(model);
      const source = channel(model.source);
      const name = model.name;
      requireValue(seenChannels.has(source) && typeof name === 'string' && name.trim().length > 0 && name.length <= 256);
      unique(source + ':' + name, seenModels);
      return { source, name, total: count(model.total), sessions: optionalCount(model.sessions), ...reasoning(model) };
    });

    const generatedAt = summary.generatedAt ?? null;
    requireValue(generatedAt === null || (typeof generatedAt === 'string'
      && generatedAt.length <= 64 && Number.isFinite(Date.parse(generatedAt))));
    return {
      from, to, generatedAt, totals, focus, sources, daily, models,
      reasoningEfforts: breakdown(summary.reasoningEfforts, 'effort', 'total', levels),
      publicMode: 'import',
    };
  }

  function demo() {
    const from = '2026-07-01';
    const to = '2026-10-28';
    const start = Date.parse(from);
    const daily = Array.from({ length: 120 }, (_, index) => {
      const day = new Date(start + index * dayMs).toISOString().slice(0, 10);
      const base = index % 7 < 2 ? 0 : 1 + index % 13;
      const codex = base * (index + 95) * 1230;
      const claude = base * (index + 95) * 540;
      const workbuddy = base * (index + 95) * 260;
      return { date: day, total: codex + claude + workbuddy, codex, claude, workbuddy };
    });
    const activeDays = daily.filter(day => day.total > 0).length;
    const sourceModels = {
      codex: ['GPT-6.2', 'GPT-5.6'],
      claude: ['Claude Opus', 'Claude Sonnet'],
      workbuddy: ['模型 A', '模型 B'],
    };
    const models = [];
    const sources = Object.keys(channels).map((id, index) => {
      const total = daily.reduce((sum, day) => sum + day[id], 0);
      const output = Math.floor(total * (0.07 + index * 0.02));
      const input = total - output;
      const cached = Math.floor(input * 0.44);
      const sessions = 270 - 77 * index;
      const primary = Math.floor(total * (0.8 - index * 0.09));
      const reasoningEfforts = id === 'codex'
        ? [{ effort: 'high', total: primary }, { effort: 'medium', total: total - primary }]
        : [];
      const primarySessions = Math.floor(sessions * 0.7);
      [primary, total - primary].forEach((amount, modelIndex) => {
        models.push({
          source: id, name: sourceModels[id][modelIndex], total: amount,
          sessions: modelIndex === 0 ? primarySessions : sessions - primarySessions,
          reasoningEfforts: reasoningEfforts.slice(modelIndex, modelIndex + 1),
        });
      });
      return {
        id, name: channels[id], state: 'ready', quality: 'measured', note: '示例渠道数据',
        coverageFrom: from, coverageTo: to, total, input, output, cached, sessions, activeDays,
        reasoningEfforts, reasoningSettings: [],
      };
    });
    const totals = { activeDays };
    for (const key of ['total', 'input', 'output', 'cached', 'sessions']) {
      totals[key] = sources.reduce((sum, source) => sum + source[key], 0);
    }
    Object.assign(totals, {
      knownSplitTotal: totals.total, splitInput: totals.input, splitOutput: totals.output,
      splitCached: totals.cached, measuredTotal: totals.total, estimatedTotal: 0,
    });
    return {
      from, to, generatedAt: null, totals, focus: null, sources, daily, models,
      reasoningEfforts: sources[0].reasoningEfforts, publicMode: 'demo',
    };
  }

  window.TokenPulsePublicData = { demo, parseSummary, maxBytes };
})();
