// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "generate-review",
    title: "응대도우미: 리뷰 답변 생성",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "generate-inquiry",
    title: "응대도우미: 문의 답변 생성",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "generate-claim",
    title: "응대도우미: 클레임 대응 생성",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return;

  const typeMap = {
    "generate-review": "review",
    "generate-inquiry": "inquiry",
    "generate-claim": "claim"
  };

  const type = typeMap[info.menuItemId];
  if (!type) return;

  // Store the request and open popup
  chrome.storage.local.set({
    pendingGeneration: {
      type,
      text: info.selectionText,
      timestamp: Date.now()
    }
  });

  // Open popup by sending message (popup needs to be open)
  // Since we can't programmatically open popup, inject a notification
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text, type) => {
      // Create floating result panel
      const existing = document.getElementById('응대도우미-panel');
      if (existing) existing.remove();

      const panel = document.createElement('div');
      panel.id = '응대도우미-panel';
      panel.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 420px; max-height: 500px;
        background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden; border: 1px solid #e5e7eb;
      `;

      panel.innerHTML = `
        <div style="padding: 16px 20px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 15px;">응대도우미</div>
            <div style="font-size: 12px; opacity: 0.85;">${type === 'review' ? '리뷰 답변' : type === 'inquiry' ? '문의 답변' : '클레임 대응'} 생성 중...</div>
          </div>
          <button id="응대도우미-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px;">✕</button>
        </div>
        <div style="padding: 16px 20px;">
          <div style="background: #f3f4f6; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; font-weight: 600;">원문</div>
            <div style="font-size: 13px; color: #374151; line-height: 1.5;">${text.length > 200 ? text.substring(0, 200) + '...' : text}</div>
          </div>
          <div id="응대도우미-result" style="display: flex; align-items: center; justify-content: center; padding: 24px;">
            <div style="width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: 응대spin 0.8s linear infinite;"></div>
            <span style="margin-left: 10px; color: #6b7280; font-size: 13px;">AI가 답변을 생성하고 있습니다...</span>
          </div>
        </div>
        <style>@keyframes 응대spin { to { transform: rotate(360deg); } }</style>
      `;

      document.body.appendChild(panel);
      document.getElementById('응대도우미-close').onclick = () => panel.remove();
    },
    args: [text, type]
  });

  // Call the API
  chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'accessToken'], async (config) => {
    const supabaseUrl = config.supabaseUrl || 'https://qbvlgzmivdycuocvcoxy.supabase.co';
    const supabaseKey = config.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidmxnem1pdmR5Y3VvY3Zjb3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDA3MDQsImV4cCI6MjA5MDkxNjcwNH0.ox5FO-vpaDtDPZL-UWztEHFSGfn7D47JI2_-lSaAzXM';

    try {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${config.accessToken || supabaseKey}`
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-response`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, text: info.selectionText })
      });

      const data = await res.json();

      // Update the panel with result
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (response, error) => {
          const resultDiv = document.getElementById('응대도우미-result');
          if (!resultDiv) return;

          if (error) {
            resultDiv.innerHTML = `<div style="color: #ef4444; font-size: 13px; padding: 12px;">❌ ${error}</div>`;
            return;
          }

          resultDiv.innerHTML = `
            <div style="width: 100%;">
              <div style="font-size: 11px; color: #3b82f6; margin-bottom: 6px; font-weight: 600;">✨ AI 생성 답변</div>
              <div style="font-size: 13px; color: #1f2937; line-height: 1.6; background: #eff6ff; border-radius: 10px; padding: 12px; border: 1px solid #dbeafe; white-space: pre-wrap;">${response}</div>
              <button id="응대도우미-copy" style="margin-top: 10px; padding: 8px 16px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; width: 100%;">
                📋 답변 복사하기
              </button>
            </div>
          `;

          document.getElementById('응대도우미-copy').onclick = () => {
            navigator.clipboard.writeText(response);
            const btn = document.getElementById('응대도우미-copy');
            btn.textContent = '✅ 복사되었습니다!';
            btn.style.background = '#10b981';
            setTimeout(() => {
              btn.textContent = '📋 답변 복사하기';
              btn.style.background = 'linear-gradient(135deg, #3b82f6, #6366f1)';
            }, 2000);
          };
        },
        args: [data.response || null, data.error || (!data.response ? '답변 생성에 실패했습니다.' : null)]
      });
    } catch (err) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => {
          const r = document.getElementById('응대도우미-result');
          if (r) r.innerHTML = `<div style="color: #ef4444; font-size: 13px;">❌ ${msg}</div>`;
        },
        args: [err.message || '네트워크 오류가 발생했습니다.']
      });
    }
  });
});
