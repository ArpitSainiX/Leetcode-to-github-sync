(function () {
  if (window.__lc2ghInjected) return;
  window.__lc2ghInjected = true;

  var processedIds = {};
  var isPatching = false;

  function log() {
    var args = ['[LC2GitHub]'].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function warn() {
    var args = ['[LC2GitHub]'].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  }

  function getSlug() {
    var m = window.location.pathname.match(/\/problems\/([^/?#]+)/);
    return m ? m[1] : '';
  }

  function getTitle() {
    var el = document.querySelector('[data-cy="question-title"], .mr-2.text-label-1, .css-v3d350');
    if (el) return el.textContent.trim();
    var slug = getSlug();
    if (slug) return slug.split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    return 'Unknown';
  }

  function getEditorCode() {
    try {
      if (window.monaco && window.monaco.editor) {
        var models = window.monaco.editor.getModels();
        if (models && models.length) {
          var val = models[0].getValue();
          if (val && val.trim().length > 5) return val;
        }
      }
    } catch (e) {}

    try {
      var lines = document.querySelectorAll('.monaco-editor .view-line');
      if (lines.length > 3) {
        return Array.from(lines).map(function (ln) { return ln.textContent.replace(/\u00a0/g, ' '); }).join('\n');
      }
    } catch (e) {}

    try {
      var ta = document.querySelector('.monaco-editor textarea, #code-editor textarea');
      if (ta && ta.value && ta.value.trim().length > 5) return ta.value;
    } catch (e) {}

    return '';
  }

  function getLanguage() {
    var selectors = [
      '[data-cy="lang-select"] .ant-select-selection-item',
      '#headlessui-listbox-button',
      '[class*="language"] button',
      '.ant-select-selection-item'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim().length < 20) return el.textContent.trim();
    }
    return 'unknown';
  }

  function post(type, payload) {
    document.dispatchEvent(new CustomEvent('lc2gh-message', {
      detail: { source: 'leetcode-to-github-extension', type: type, payload: payload }
    }));
  }

  function isLeetCodeApiUrl(url) {
    if (typeof url !== 'string') return false;
    var keywords = ['/submissions/', '/submit/', '/check/', '/interpret/', '/graphql'];
    for (var i = 0; i < keywords.length; i++) {
      if (url.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  function isCheckUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.indexOf('check') === -1) return false;
    if (url.indexOf('submission') === -1 && url.indexOf('submissions') === -1) return false;
    return true;
  }

  function extractSubmissionId(url) {
    var m = url.match(/\/submissions\/detail\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function processAccepted(submissionId, data) {
    if (processedIds[submissionId]) {
      log('Already processed submission', submissionId);
      return;
    }
    processedIds[submissionId] = true;

    log('ACCEPTED! Submission ID:', submissionId);

    var code = getEditorCode();
    var lang = data && data.pretty_lang ? data.pretty_lang : getLanguage();
    var slug = getSlug();
    var title = getTitle();

    log('Problem:', title, '| Lang:', lang, '| Code length:', code ? code.length : 0);

    if (!code || code.trim().length < 5) {
      warn('No code from editor, cannot push');
      post('ERROR', { message: 'Could not extract code from editor' });
      return;
    }

    post('SOLVED', {
      problemName: slug,
      problemTitle: title,
      code: code,
      language: lang
    });
  }

  function patchFetch() {
    if (isPatching) return;
    isPatching = true;
    log('Patching fetch...');

    var originalFetch = window.fetch;

    window.fetch = function () {
      var args = arguments;
      var url = '';
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] instanceof Request) {
        url = args[0].url;
      } else if (args[0] && typeof args[0] === 'object' && args[0].href) {
        url = args[0].href;
      }

      if (url && isLeetCodeApiUrl(url)) {
        log('fetch:', url);
      }

      var promise = originalFetch.apply(this, args);

      if (!url || !isCheckUrl(url)) {
        return promise;
      }

      log('>>> Intercepting check:', url);

      return promise.then(function (response) {
        var clone = response.clone();
        clone.json().then(function (data) {
          var sm = (data.status_msg || '').toLowerCase();
          var st = (data.state || '').toLowerCase();
          var sc = data.status_code;
          log('check response: state=' + st + ' msg=' + sm + ' code=' + sc, data);

          if (st === 'success' || sm === 'accepted' || sc === 10) {
            var sid = extractSubmissionId(url);
            if (sid) processAccepted(sid, data);
          }
        }).catch(function (e) {
          log('check parse error:', e.message);
        });
        return response;
      });
    };
  }

  function patchXHR() {
    log('Patching XHR...');

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._lcUrl = typeof url === 'string' ? url : (url ? '' + url : '');
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var url = this._lcUrl;
      if (url && isLeetCodeApiUrl(url)) {
        log('XHR:', url);
      }

      if (url && isCheckUrl(url)) {
        log('>>> Intercepting XHR check:', url);
        var self = this;
        this.addEventListener('load', function () {
          try {
            var data = JSON.parse(self.responseText);
            var sm = (data.status_msg || '').toLowerCase();
            var st = (data.state || '').toLowerCase();
            var sc = data.status_code;
            log('XHR check response: state=' + st + ' msg=' + sm + ' code=' + sc);

            if (st === 'success' || sm === 'accepted' || sc === 10) {
              var sid = extractSubmissionId(url);
              if (sid) processAccepted(sid, data);
            }
          } catch (e) {}
        });
      }
      return origSend.apply(this, arguments);
    };
  }

  function init() {
    log('Starting on', window.location.host + window.location.pathname);
    patchFetch();
    patchXHR();
  }

  init();
})();
