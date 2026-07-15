(function () {
  console.log('[LC2GitHub] Content script ready');

  var badge = document.createElement('div');
  badge.id = 'lc2gh-badge';
  badge.style.cssText = 'position:fixed;top:0;right:0;z-index:99999;background:#6c63ff;color:#fff;padding:3px 8px;font:12px monospace;border-radius:0 0 0 4px;';
  badge.textContent = 'LC2GitHub: starting...';
  document.documentElement.appendChild(badge);

  chrome.runtime.sendMessage({ type: 'INJECT' }, function (response) {
    badge.textContent = response && response.success
      ? 'LC2GitHub: injected ✓'
      : 'LC2GitHub: inject failed';
  });

  document.addEventListener('lc2gh-message', function (event) {
    var detail = event.detail;
    if (!detail || detail.source !== 'leetcode-to-github-extension') return;

    if (detail.type === 'SOLVED') {
      badge.textContent = 'LC2GitHub: pushing...';
      chrome.runtime.sendMessage(detail, function (response) {
        if (chrome.runtime.lastError) {
          badge.textContent = 'LC2GitHub: error - ' + chrome.runtime.lastError.message;
          return;
        }
        badge.textContent = response && response.success
          ? 'LC2GitHub: PUSHED ✓'
          : 'LC2GitHub: push failed';
      });
    }

    if (detail.type === 'ERROR') {
      badge.textContent = 'LC2GitHub: error - ' + detail.payload.message;
    }
  });
})();
