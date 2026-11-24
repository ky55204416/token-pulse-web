(() => {
  const storageKey = 'compute-dashboard-token-units';
  const integer = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  let language = 'zh';
  try {
    if (localStorage.getItem(storageKey) === 'en') language = 'en';
  } catch {}

  function format(amount) {
    if (!Number.isFinite(amount)) return '—';
    const magnitude = Math.abs(amount);
    const scales = language === 'zh'
      ? [[100000000, '亿'], [10000, '万']]
      : [[1000000000000, 'T'], [1000000000, 'B'], [1000000, 'M'], [1000, 'K']];
    const scale = scales.find(([size]) => magnitude >= size);
    if (!scale) return integer.format(amount);
    const [size, unit] = scale;
    return (amount / size).toFixed(2) + unit;
  }

  window.computeUnits = {
    format,
    integer: amount => Number.isFinite(amount) ? integer.format(amount) : '—',
    get: () => language,
    set(value) {
      language = value === 'en' ? 'en' : 'zh';
      try { localStorage.setItem(storageKey, language); } catch {}
    },
  };
})();
