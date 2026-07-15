document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('githubToken');
  const ownerInput = document.getElementById('repoOwner');
  const nameInput = document.getElementById('repoName');
  const saveBtn = document.getElementById('saveBtn');
  const msg = document.getElementById('msg');
  const testBtn = document.getElementById('testBtn');
  const testResult = document.getElementById('testResult');

  chrome.storage.sync.get(['githubToken', 'repoOwner', 'repoName'], (data) => {
    if (data.githubToken) tokenInput.value = data.githubToken;
    if (data.repoOwner) ownerInput.value = data.repoOwner;
    if (data.repoName) nameInput.value = data.repoName;
  });

  function showMsg(text, isError = false) {
    msg.textContent = text;
    msg.className = `msg-row ${isError ? 'error' : 'success'}`;
    msg.classList.remove('hidden');
    setTimeout(() => { msg.classList.add('hidden'); }, 4000);
  }

  function showTestResult(text, isError = false) {
    testResult.textContent = text;
    testResult.className = isError ? 'error' : 'success';
    testResult.classList.remove('hidden');
  }

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const owner = ownerInput.value.trim();
    const name = nameInput.value.trim();

    if (!token || !owner || !name) {
      showMsg('All fields are required.', true);
      return;
    }

    chrome.storage.sync.set({ githubToken: token, repoOwner: owner, repoName: name }, () => {
      showMsg('Settings saved successfully!');
    });
  });

  testBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const owner = ownerInput.value.trim();
    const name = nameInput.value.trim();

    if (!token || !owner || !name) {
      showTestResult('Save your settings first.', true);
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    showTestResult('Testing connection...', false);

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!repoRes.ok) {
        const err = await repoRes.json();
        throw new Error(err.message || 'Repository not found or no access');
      }

      const repoData = await repoRes.json();

      const userRes = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!userRes.ok) {
        throw new Error('Token is invalid or expired');
      }

      const userData = await userRes.json();

      showTestResult(
        `✅ Connected as ${userData.login} — repo "${owner}/${name}" exists. Default branch: ${repoData.default_branch}`,
        false
      );
    } catch (e) {
      showTestResult(`❌ ${e.message}`, true);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  });
});
