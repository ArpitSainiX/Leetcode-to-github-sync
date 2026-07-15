const GITHUB_API = 'https://api.github.com';

function getSettings() {
  return chrome.storage.sync.get(['githubToken', 'repoOwner', 'repoName']);
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'INJECT') {
    var tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ success: false, error: 'no tab' });
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['injected.js'],
      world: 'MAIN'
    }).then(function () {
      sendResponse({ success: true });
    }).catch(function (err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'SOLVED') {
    pushToGitHub(message.payload, sendResponse);
    return true;
  }

  if (message.type === 'ERROR') {
    console.error('[LC2GitHub] Error from page:', message.payload);
    sendResponse({ received: true });
  }

  if (message.type === 'CHECK_SETTINGS') {
    getSettings().then(function (s) {
      sendResponse({
        configured: !!(s.githubToken && s.repoOwner && s.repoName),
        settings: s
      });
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set(message.payload, function () {
      sendResponse({ success: true });
    });
    return true;
  }
});

function pushToGitHub(payload, sendResponse) {
  getSettings().then(function (settings) {
    if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
      sendResponse({ success: false, error: 'GitHub not configured' });
      return;
    }

    var ext = getExtension(payload.language);
    var fileName = payload.problemName + '/' + payload.problemName + ext;
    var commitMsg = 'Add solution for ' + payload.problemTitle;
    var timestamp = new Date().toISOString();
    var header = '// LeetCode Solution: ' + payload.problemTitle + '\n// Submitted: ' + timestamp + '\n// Language: ' + payload.language + '\n\n';
    var content = btoa(unescape(encodeURIComponent(header + payload.code)));

    var headers = {
      'Authorization': 'Bearer ' + settings.githubToken,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    };

    var checkUrl = GITHUB_API + '/repos/' + settings.repoOwner + '/' + settings.repoName + '/contents/' + fileName;

    fetch(checkUrl, { headers: headers })
      .then(function (res) {
        if (res.status === 200) {
          return res.json().then(function (data) { return data.sha; });
        }
        if (res.status === 404) {
          return null;
        }
        return res.json().then(function (data) {
          throw new Error(data.message || 'Check failed');
        });
      })
      .then(function (sha) {
        var body = { message: commitMsg, content: content };
        if (sha) body.sha = sha;

        return fetch(checkUrl, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(body)
        });
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.message || 'Push failed');
          });
        }
        return res.json();
      })
      .then(function (result) {
        sendResponse({
          success: true,
          result: {
            htmlUrl: result.content && result.content.html_url ?
              result.content.html_url :
              'https://github.com/' + settings.repoOwner + '/' + settings.repoName + '/blob/main/' + fileName,
            fileName: fileName
          }
        });
      })
      .catch(function (err) {
        sendResponse({ success: false, error: err.message });
      });
  });
}

function getExtension(language) {
  var map = {
    'python': '.py', 'python3': '.py', 'c': '.c', 'cpp': '.cpp',
    'java': '.java', 'javascript': '.js', 'typescript': '.ts',
    'go': '.go', 'rust': '.rs', 'swift': '.swift', 'kotlin': '.kt',
    'scala': '.scala', 'ruby': '.rb', 'php': '.php', 'csharp': '.cs',
    'dart': '.dart', 'racket': '.rkt', 'erlang': '.erl', 'elixir': '.ex',
    'mysql': '.sql', 'mssql': '.sql', 'bash': '.sh'
  };
  var key = (language || '').toLowerCase();
  return map[key] || '.txt';
}
