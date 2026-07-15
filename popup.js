document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('githubToken');
  const ownerInput = document.getElementById('repoOwner');
  const nameInput = document.getElementById('repoName');
  const saveBtn = document.getElementById('saveBtn');
  const saveMsg = document.getElementById('saveMsg');
  const configStatus = document.getElementById('config-status');
  const settingsForm = document.getElementById('settings-form');
  const infoSection = document.getElementById('info-section');
  const repoDisplay = document.getElementById('repoDisplay');

  function showMsg(text, isError = false) {
    saveMsg.textContent = text;
    saveMsg.className = isError ? 'error' : 'success';
    setTimeout(() => { saveMsg.className = 'hidden'; }, 3000);
  }

  chrome.runtime.sendMessage({ type: 'CHECK_SETTINGS' }, (response) => {
    if (response.configured) {
      configStatus.textContent = '✅ Configured';
      configStatus.className = 'status-badge success';
      settingsForm.classList.add('hidden');
      infoSection.classList.remove('hidden');
      repoDisplay.textContent = `${response.settings.repoOwner}/${response.settings.repoName}`;

      tokenInput.value = response.settings.githubToken || '';
      ownerInput.value = response.settings.repoOwner || '';
      nameInput.value = response.settings.repoName || '';
    } else {
      configStatus.textContent = '⚠️ Not configured';
      configStatus.className = 'status-badge warning';
      settingsForm.classList.remove('hidden');
      infoSection.classList.add('hidden');
    }
  });

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const owner = ownerInput.value.trim();
    const name = nameInput.value.trim();

    if (!token || !owner || !name) {
      showMsg('All fields are required.', true);
      return;
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      showMsg('Token should start with ghp_ or github_pat_', true);
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: { githubToken: token, repoOwner: owner, repoName: name }
    }, (response) => {
      if (response?.success) {
        showMsg('Settings saved!');
        configStatus.textContent = '✅ Configured';
        configStatus.className = 'status-badge success';
        settingsForm.classList.add('hidden');
        infoSection.classList.remove('hidden');
        repoDisplay.textContent = `${owner}/${name}`;
      } else {
        showMsg('Failed to save settings.', true);
      }
    });
  });

  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
