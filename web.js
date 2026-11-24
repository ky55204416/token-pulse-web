(() => {
  const { demo, parseSummary, maxBytes } = window.TokenPulsePublicData;
  const input = document.querySelector('#summary-file');
  const reset = document.querySelector('#reset-demo');
  const status = document.querySelector('#import-status');
  const importButton = document.querySelector('#import-summary');
  const refreshButton = document.querySelector('#refresh-local');
  const local = 'http://127.0.0.1:4317/connect-web';
  const authorization = /^#connect=([A-Za-z0-9_-]{43})$/.exec(location.hash);
  let capability = authorization?.[1] || '';
  if (authorization) history.replaceState(history.state, '', location.pathname + location.search);

  function showStatus(message, error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('web-status--error', error);
  }

  async function requestUsage(method) {
    const response = await fetch(local + '/usage', {
      method,
      headers: { Authorization: `Bearer ${capability}` },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(method === 'POST' ? 60_000 : 15_000),
    });
    if (response.status === 401) {
      capability = '';
      throw new Error('本次授权已失效。请再次点击「刷新本机数据」连接。');
    }
    if (!response.ok) throw new Error('本机服务暂时无法读取用量，请稍后重试。');
    return response.json();
  }

  async function refreshUsage(render) {
    if (!capability) {
      showStatus('请在新打开的本机页面授权。如果打不开，请先启动下载的智脉本机版。');
      window.open(local, '_blank', 'noopener,noreferrer');
      return;
    }
    refreshButton.disabled = importButton.disabled = reset.disabled = true;
    refreshButton.textContent = '正在刷新';
    showStatus('正在查找本机用量记录。请保持智脉本机版运行。');
    try {
      await requestUsage('POST');
      const deadline = Date.now() + 15 * 60_000;
      do {
        const result = await requestUsage('GET');
        if (!result.refreshing) {
          if (!result.summary) throw new Error('本机用量尚未就绪。请在本机版查看采集进度。');
          const summary = parseSummary(JSON.stringify(result.summary));
          render({ ...summary, publicMode: 'local' });
          reset.hidden = false;
          showStatus(summary.totals.total > 0 ? '已更新近 30 天的本机用量。' : '已完成扫描，近 30 天暂无可用记录。');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } while (Date.now() < deadline);
      showStatus('本机仍在扫描历史记录。稍后再点「刷新本机数据」查看。');
    } catch (error) {
      const unavailable = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
      showStatus(unavailable ? '连接不上本机版。请确认本机版正在运行，并在浏览器中允许连接本机网络。' : error.message, true);
    } finally {
      refreshButton.disabled = importButton.disabled = reset.disabled = false;
      refreshButton.textContent = '刷新本机数据';
    }
  }

  window.TokenPulseWeb = {
    start(render) {
      refreshButton.addEventListener('click', () => void refreshUsage(render));
      importButton.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const [file] = input.files;
        input.value = '';
        if (!file) return;
        if (file.size > maxBytes) {
          showStatus(`摘要文件超过 ${maxBytes / 1024 / 1024} MB。请从 Mac 版导出较短日期范围的摘要。`, true);
          return;
        }
        refreshButton.disabled = importButton.disabled = reset.disabled = true;
        try {
          const summary = parseSummary(await file.text());
          render(summary);
          reset.hidden = false;
          showStatus('已导入摘要。关闭或刷新页面后，页面会恢复显示示例。');
        } catch (error) {
          showStatus(error.message || '无法打开摘要，请选择智脉导出的 JSON 文件。', true);
        } finally {
          refreshButton.disabled = importButton.disabled = reset.disabled = false;
        }
      });
      reset.addEventListener('click', () => {
        render(demo());
        reset.hidden = true;
        showStatus('');
        importButton.focus();
      });
      render(demo());
      if (capability) showStatus('本机版已授权。点击「刷新本机数据」开始读取近 30 天用量。');
    },
  };
})();
