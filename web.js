(() => {
  const { demo, parseSummary, maxBytes } = window.TokenPulsePublicData;
  const input = document.querySelector('#summary-file');
  const reset = document.querySelector('#reset-demo');
  const status = document.querySelector('#import-status');
  const importButton = document.querySelector('#import-summary');

  function showStatus(message, error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('web-status--error', error);
  }

  window.TokenPulseWeb = {
    start(render) {
      importButton.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const [file] = input.files;
        input.value = '';
        if (!file) return;
        if (file.size > maxBytes) {
          showStatus(`摘要文件超过 ${maxBytes / 1024 / 1024} MB。请从 Mac 版导出较短日期范围的摘要。`, true);
          return;
        }
        importButton.disabled = true;
        reset.disabled = true;
        try {
          const summary = parseSummary(await file.text());
          render(summary);
          reset.hidden = false;
          showStatus('已导入摘要。关闭或刷新页面后，页面会恢复显示示例。');
        } catch (error) {
          showStatus(error.message || '无法打开摘要，请选择智脉导出的 JSON 文件。', true);
        } finally {
          importButton.disabled = false;
          reset.disabled = false;
        }
      });
      reset.addEventListener('click', () => {
        render(demo());
        reset.hidden = true;
        showStatus('');
        importButton.focus();
      });
      render(demo());
    },
  };
})();
