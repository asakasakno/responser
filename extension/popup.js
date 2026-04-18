const SUPABASE_URL = 'https://qbvlgzmivdycuocvcoxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidmxnem1pdmR5Y3VvY3Zjb3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDA3MDQsImV4cCI6MjA5MDkxNjcwNH0.ox5FO-vpaDtDPZL-UWztEHFSGfn7D47JI2_-lSaAzXM';

let currentType = 'review';
let currentStyle = 'none';
let accessToken = null;

const placeholders = {
  review: '고객 리뷰 내용을 입력하세요...\n\n💡 이미지를 Ctrl+V로 붙여넣을 수도 있습니다.',
  inquiry: '고객 문의 내용을 입력하세요...\n\n💡 이미지를 Ctrl+V로 붙여넣을 수도 있습니다.',
  claim: '클레임 내용을 입력하세요...\n\n💡 이미지를 Ctrl+V로 붙여넣을 수도 있습니다.'
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(['accessToken', 'refreshToken', 'userEmail']);
  if (stored.accessToken) {
    accessToken = stored.accessToken;
    showMain(stored.userEmail);
  }

  // Tab clicks
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentType = tab.dataset.type;
      document.getElementById('input-text').placeholder = placeholders[currentType];
    });
  });

  // Style buttons
  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStyle = btn.dataset.style;
    });
  });
  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);

  // Generate
  document.getElementById('generate-btn').addEventListener('click', handleGenerate);

  // Page capture
  document.getElementById('capture-btn').addEventListener('click', handleCapture);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Copy all
  document.getElementById('copy-all-btn').addEventListener('click', handleCopyAll);

  // Image paste
  document.getElementById('input-text').addEventListener('paste', handlePaste);

  // Enter shortcut
  document.getElementById('input-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleGenerate();
    }
  });
});

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) { showError('이메일과 비밀번호를 입력해주세요.'); return; }

  btn.disabled = true;
  btn.textContent = '로그인 중...';

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || '로그인 실패');

    accessToken = data.access_token;
    await chrome.storage.local.set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userEmail: email
    });
    showMain(email);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '로그인';
  }
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function showMain(email) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'block';
  document.getElementById('user-email').textContent = email || '';
}

async function handleLogout() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'userEmail']);
  accessToken = null;
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
}

async function callFunction(name, body) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${accessToken || SUPABASE_KEY}`,
    'x-client-source': 'extension'
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      headers['x-client-source'] = 'extension';
      const res2 = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: 'POST', headers, body: JSON.stringify(body)
      });
      return res2.json();
    }
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  return res.json();
}

async function refreshToken() {
  const stored = await chrome.storage.local.get(['refreshToken']);
  if (!stored.refreshToken) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: stored.refreshToken })
    });
    const data = await res.json();
    if (!res.ok) return false;

    accessToken = data.access_token;
    await chrome.storage.local.set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token
    });
    return true;
  } catch { return false; }
}

async function handleGenerate() {
  const text = document.getElementById('input-text').value.trim();
  if (!text) return;

  showLoading('AI가 답변을 생성하고 있습니다...');

  try {
    const payload = { type: currentType, text };
    if (currentStyle && currentStyle !== 'none') payload.style = currentStyle;
    const data = await callFunction('generate-response', payload);
    if (data.error) throw new Error(data.error);
    showResults([{ input: text, output: data.response }]);
  } catch (err) {
    alert('생성 실패: ' + err.message);
    hideLoading();
  }
}

async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) await processImage(file);
      return;
    }
  }
}

async function processImage(file) {
  showLoading('이미지에서 텍스트를 추출하고 있습니다...');

  try {
    const base64 = await fileToBase64(file);

    const extractData = await callFunction('extract-from-image', {
      image: base64, type: currentType
    });

    if (extractData.error) throw new Error(extractData.error);

    const items = extractData.items || [];
    if (items.length === 0) {
      alert('이미지에서 텍스트를 찾을 수 없습니다.');
      hideLoading();
      return;
    }

    setLoadingText(`${items.length}개 항목 발견! 답변 생성 중...`);

    const results = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(((i + 1) / items.length) * 100);
      setLoadingText(`답변 생성 중... (${i + 1}/${items.length})`);

      const data = await callFunction('generate-response', {
        type: currentType, text: items[i]
      });
      results.push({
        input: items[i],
        output: data.response || '생성 실패'
      });
    }

    showResults(results);
  } catch (err) {
    alert('처리 실패: ' + err.message);
    hideLoading();
  }
}

async function handleCapture() {
  showLoading('페이지를 캡처하고 있습니다...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const base64 = screenshot.split(',')[1];

    setLoadingText('이미지에서 텍스트를 추출하고 있습니다...');

    const extractData = await callFunction('extract-from-image', {
      image: base64, type: currentType
    });

    if (extractData.error) throw new Error(extractData.error);

    const items = extractData.items || [];
    if (items.length === 0) {
      alert('페이지에서 리뷰/문의를 찾을 수 없습니다.');
      hideLoading();
      return;
    }

    const results = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(((i + 1) / items.length) * 100);
      setLoadingText(`답변 생성 중... (${i + 1}/${items.length})`);

      const data = await callFunction('generate-response', {
        type: currentType, text: items[i]
      });
      results.push({
        input: items[i],
        output: data.response || '생성 실패'
      });
    }

    showResults(results);
  } catch (err) {
    alert('캡처 실패: ' + err.message);
    hideLoading();
  }
}

function showResults(results) {
  hideLoading();
  const area = document.getElementById('results-area');
  const list = document.getElementById('results-list');
  area.style.display = 'block';

  list.innerHTML = results.map((r, i) => `
    <div class="result-card">
      <div class="result-card-header">
        <span class="result-num">#${i + 1}</span>
        <button class="copy-btn" data-index="${i}">복사</button>
      </div>
      <div class="result-input" data-expand="toggle">
        <span class="result-input-label">▸ 원문 (클릭하여 펼치기)</span>
        ${escapeHtml(r.input)}
      </div>
      <div class="result-output">${escapeHtml(r.output)}</div>
    </div>
  `).join('');

  // Copy buttons
  list.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      navigator.clipboard.writeText(results[idx].output);
      btn.textContent = '✅ 복사됨';
      setTimeout(() => btn.textContent = '복사', 2000);
    });
  });

  // Expand input
  list.querySelectorAll('.result-input').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('expanded'));
  });

  // Store results for copy all
  area.dataset.results = JSON.stringify(results);
}

function handleCopyAll() {
  const area = document.getElementById('results-area');
  try {
    const results = JSON.parse(area.dataset.results || '[]');
    const text = results.map((r, i) => `[${i + 1}]\n원문: ${r.input}\n답변: ${r.output}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);

    const btn = document.getElementById('copy-all-btn');
    btn.textContent = '✅ 복사됨';
    setTimeout(() => btn.textContent = '전체 복사', 2000);
  } catch {}
}

function showLoading(text) {
  document.getElementById('results-area').style.display = 'none';
  document.getElementById('loading-area').style.display = 'flex';
  document.getElementById('loading-text').textContent = text;
  document.getElementById('progress-fill').style.width = '0%';
}

function hideLoading() {
  document.getElementById('loading-area').style.display = 'none';
}

function setLoadingText(t) {
  document.getElementById('loading-text').textContent = t;
}

function setProgress(pct) {
  document.getElementById('progress-fill').style.width = pct + '%';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
