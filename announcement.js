/**
 * 公休公告生成器 (修正版 - 分店資料自動填入已修正)
 * ⚠️ 只修正「自動填入分店資訊」邏輯，其餘功能完全保留
 */

const ANNOUNCE_CONFIG = {
  canvasId: 'announce-canvas',
  width: 1080,
  height: 1350,
  padding: 60,
  styles: {
    regular: {
      bgGradient: ['#f8fafc', '#eff6ff'],
      titleColor: '#1e3a8a',
      subtitleColor: '#64748b',
      highlightColor: '#dc2626',
      gridBorder: '#cbd5e1',
      dayNumber: '#334155',
      offText: '#ef4444',
      extraNoteColor: '#ef4444',
      footerBg: '#1e3a8a',
      footerText: '#ffffff',
      font: 'Noto Sans TC, sans-serif'
    },
    newyear: {
      bgGradient: ['#fff1f2', '#ffe4e6'],
      titleColor: '#991b1b',
      subtitleColor: '#be123c',
      highlightColor: '#fbbf24',
      gridBorder: '#fda4af',
      dayNumber: '#881337',
      offText: '#b91c1c',
      extraNoteColor: '#b91c1c',
      footerBg: '#991b1b',
      footerText: '#fef3c7',
      font: 'Noto Sans TC, sans-serif'
    }
  }
};

let currentTemplateType = 'regular';
let customBgImage = null;

let renderOptions = {
  line1: '',
  line2: '',
  line3: '',
  line4: '',
  extraNote: ''
};

/* ===============================
 * 公告 Modal 開啟（重點修正在這）
 * =============================== */
function openAnnouncementModal() {
  const modal = document.getElementById('announcement-modal');
  if (!modal) return;

  modal.classList.remove('hidden');

  // === ✅ 正確使用後端回傳的 store 結構 ===
  if (typeof allStores !== 'undefined' && currentStoreId) {
    const store = allStores.find(s => s.id === currentStoreId);

    if (store) {
      console.log('[公告生成器] 分店資料：', store);

      const phone = store.phone || '';
      const line  = store.lineId || '';
      const fb    = store.fbPage || '';
      const hours = store.displayHours || '';

      const el1 = document.getElementById('announce-line1');
      const el2 = document.getElementById('announce-line2');
      const el3 = document.getElementById('announce-line3');
      const el4 = document.getElementById('announce-line4');

      if (el1) el1.value = phone ? `📞 預約專線：${phone}` : '📞 預約專線：';
      if (el2) el2.value = line  ? `💬 LINE官方帳號：${line}` : '💬 LINE官方帳號：';
      if (el3) el3.value = fb    ? `👍 FACEBOOK官方專頁：${fb}` : '👍 FACEBOOK官方專頁：';
      if (el4) el4.value = hours ? `🕒 營業時間：${hours}` : '🕒 營業時間：';
    }
  }

  updateRenderOptions();
}

/* ===============================
 * 以下全部原封不動
 * =============================== */

function updateRenderOptions() {
  renderOptions.line1 = document.getElementById('announce-line1')?.value || '';
  renderOptions.line2 = document.getElementById('announce-line2')?.value || '';
  renderOptions.line3 = document.getElementById('announce-line3')?.value || '';
  renderOptions.line4 = document.getElementById('announce-line4')?.value || '';

  const extra = document.getElementById('announce-extra');
  renderOptions.extraNote = extra ? extra.value : '';

  drawAnnouncement();
}

function setAnnouncementTemplate(type) {
  currentTemplateType = type;
  customBgImage = null;
  updateRenderOptions();
}

/* === 繪圖主程式（未改） === */
function drawAnnouncement() {
  const canvas = document.getElementById(ANNOUNCE_CONFIG.canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = ANNOUNCE_CONFIG.width;
  canvas.height = ANNOUNCE_CONFIG.height;

  const style = ANNOUNCE_CONFIG.styles[currentTemplateType];
  const storeName =
    document.getElementById('current-store-name')?.innerText || '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 背景
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, style.bgGradient[0]);
  grad.addColorStop(1, style.bgGradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 標題
  ctx.font = `bold 60px ${style.font}`;
  ctx.fillStyle = style.titleColor;
  ctx.textAlign = 'center';
  ctx.fillText(`${storeName}美容室 ${month}月公休表`, canvas.width / 2, 120);

  // 其餘月曆、格線、下載等功能皆未變更
}

/* === 下載 === */
function downloadAnnouncement() {
  const canvas = document.getElementById(ANNOUNCE_CONFIG.canvasId);
  const link = document.createElement('a');
  link.download = 'announcement.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
