/**
 * 公休公告生成器 (月曆版 - 修正欄位對應 + 全版背景圖 + 清除背景 + 空白區備註 + 圖片縮放模式 + 圖片置頂 + 新年預設背景)
 * 負責將公休日資料繪製成圖片
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
            highlightColor: '#dc2626', // 預約制-深紅色
            gridBorder: '#cbd5e1', 
            dayNumber: '#334155', 
            offText: '#ef4444', 
            extraNoteColor: '#ef4444', // 備註文字顏色
            footerBg: '#1e3a8a', 
            footerText: '#ffffff', 
            font: 'Noto Sans TC, sans-serif'
        },
        newyear: {
            bgGradient: ['#fff1f2', '#ffe4e6'], 
            titleColor: '#991b1b', 
            subtitleColor: '#be123c',
            highlightColor: '#fbbf24', // 預約制-亮黃色 
            gridBorder: '#fda4af', 
            dayNumber: '#881337', 
            offText: '#b91c1c', 
            extraNoteColor: '#b91c1c', // 備註文字顏色
            footerBg: '#991b1b', 
            footerText: '#fef3c7', 
            font: 'Noto Sans TC, sans-serif'
        }
    }
};

let currentTemplateType = 'regular';
let customBgImage = null;
let renderOptions = {
    textColorMode: 'dark',
    line1: '', line2: '', line3: '', line4: '',
    extraNote: '' 
};

function initAnnouncementGenerator() {
    const fileInput = document.getElementById('announce-bg-upload');
    if (fileInput) {
        // 1. 監聽上傳事件
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() { customBgImage = img; drawAnnouncement(); };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        const container = fileInput.closest('div').parentElement;

        // 2. 自動插入清除背景按鈕
        if (container && !document.getElementById('btn-clear-bg')) {
            const clearBtn = document.createElement('button');
            clearBtn.id = 'btn-clear-bg';
            clearBtn.className = 'mt-3 w-full py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-200 transition text-sm font-bold flex items-center justify-center gap-2';
            clearBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> 清除背景還原';
            clearBtn.onclick = function() {
                customBgImage = null; 
                fileInput.value = ''; 
                // 切換回預設模板時，如果是新年版要重新載入預設圖，如果是常規版就清空
                if (currentTemplateType === 'newyear') {
                    setAnnouncementTemplate('newyear');
                } else {
                    drawAnnouncement();
                }
            };
            container.appendChild(clearBtn);
        }

        // 3. 自動插入「完整顯示」勾選框 (控制圖片縮放)
        if (container && !document.getElementById('bg-fit-checkbox')) {
            const fitWrapper = document.createElement('div');
            fitWrapper.className = 'mt-2 flex items-center px-1';
            fitWrapper.innerHTML = `
                <input type="checkbox" id="bg-fit-checkbox" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer">
                <label for="bg-fit-checkbox" class="ml-2 text-sm font-bold text-gray-700 cursor-pointer">完整顯示原圖 (不裁切)</label>
            `;
            // 插入在清除按鈕下方
            container.appendChild(fitWrapper);
            
            // 綁定事件：勾選狀態改變時重繪
            document.getElementById('bg-fit-checkbox').addEventListener('change', drawAnnouncement);
        }

        // 4. 自動插入「額外備註」輸入框
        const line4Input = document.getElementById('announce-line4');
        if (line4Input && !document.getElementById('announce-extra')) {
            const infoContainer = line4Input.parentElement;
            
            const noteWrapper = document.createElement('div');
            noteWrapper.innerHTML = `
                <label class="block text-sm font-bold text-gray-700 mb-1 mt-4 border-t pt-4">額外備註 (顯示於月曆下方)</label>
                <textarea id="announce-extra" class="w-full border p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500" rows="3" placeholder="例如：\n春節期間照常營業\n歡迎提早預約！"></textarea>
            `;
            infoContainer.appendChild(noteWrapper);

            document.getElementById('announce-extra').addEventListener('input', updateRenderOptions);
        }
    }
}

function openAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // --- 自動填入分店資料 ---
        if (typeof allStores !== 'undefined' && currentStoreId) {
            const store = allStores.find(s => s.id === currentStoreId);
            if (store) {
                console.log("公告生成器 - 讀取分店資料:", store); 

                // 建立正規化對照表
                const normalizedStore = {};
                Object.keys(store).forEach(k => {
                    const cleanKey = k.toString().replace(/\s+/g, '').toLowerCase();
                    normalizedStore[cleanKey] = store[k];
                });

                const getValue = (targetKey) => {
                    if (store[targetKey] !== undefined) return store[targetKey];
                    const cleanTarget = targetKey.replace(/\s+/g, '').toLowerCase();
                    if (normalizedStore[cleanTarget] !== undefined) return normalizedStore[cleanTarget];
                    return '';
                };

                const phone = getValue('預約專線');
                const line = getValue('LINE官方帳號');
                const fb = getValue('FACEBOOK官方專頁');
                const hours = getValue('營業時間');

                const elLine1 = document.getElementById('announce-line1');
                const elLine2 = document.getElementById('announce-line2');
                const elLine3 = document.getElementById('announce-line3');
                const elLine4 = document.getElementById('announce-line4');

                if(elLine1) elLine1.value = phone ? `📞 預約專線：${phone}` : (elLine1.value || '📞 預約專線：');
                if(elLine2) elLine2.value = line ? `💬 LINE官方帳號：${line}` : (elLine2.value || '💬 LINE官方帳號：');
                if(elLine3) elLine3.value = fb ? `👍 FACEBOOK官方專頁：${fb}` : (elLine3.value || '👍 FACEBOOK官方專頁：');
                if(elLine4) elLine4.value = hours ? `🕒 營業時間：${hours}` : (elLine4.value || '🕒 營業時間：10:00 - 21:00');
            }
        }
        updateRenderOptions();
    }
}

function updateRenderOptions() {
    renderOptions.line1 = document.getElementById('announce-line1').value;
    renderOptions.line2 = document.getElementById('announce-line2').value;
    renderOptions.line3 = document.getElementById('announce-line3').value;
    renderOptions.line4 = document.getElementById('announce-line4').value;
    const extraInput = document.getElementById('announce-extra');
    renderOptions.extraNote = extraInput ? extraInput.value : '';
    
    drawAnnouncement();
}

function setAnnouncementTemplate(type) {
    currentTemplateType = type;
    const fileInput = document.getElementById('announce-bg-upload');
    const fitCheckbox = document.getElementById('bg-fit-checkbox');

    // 清空手動上傳的圖片 Input (但不一定清空 customBgImage，看情況)
    if(fileInput) fileInput.value = '';

    if (type === 'newyear') {
        // 新年版：如果沒有手動上傳的圖片 (或是被清除)，就載入預設圖
        // 為了確保切換時能生效，這裡我們重新建立一個 Image 物件
        const img = new Image();
        img.onload = function() { 
            customBgImage = img; 
            // 強制勾選「完整顯示」
            if(fitCheckbox) fitCheckbox.checked = true;
            drawAnnouncement(); 
        };
        // 設定圖片路徑，確保 background02.jpg 和 index.html 在同一目錄下
        img.src = 'background02.jpg'; 
    } else {
        // 常規版：清除背景圖
        customBgImage = null; 
        if(fitCheckbox) fitCheckbox.checked = false; // 取消勾選
        updateRenderOptions();
    }
}

function drawAnnouncement() {
    const canvas = document.getElementById(ANNOUNCE_CONFIG.canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = ANNOUNCE_CONFIG.width;
    canvas.height = ANNOUNCE_CONFIG.height;

    const style = ANNOUNCE_CONFIG.styles[currentTemplateType];
    const storeName = document.getElementById('current-store-name') ? document.getElementById('current-store-name').innerText : '美容預約';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // 1. 繪製背景
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, style.bgGradient[0]);
    grad.addColorStop(1, style.bgGradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 如果有自訂圖片 (或預設圖片)，再疊上去
    if (customBgImage) {
        const isContain = document.getElementById('bg-fit-checkbox') && document.getElementById('bg-fit-checkbox').checked;
        if (isContain) {
            drawContainImage(ctx, customBgImage, canvas.width, canvas.height);
        } else {
            drawCoverImage(ctx, customBgImage, canvas.width, canvas.height);
        }
    }

    // 2. 標題與副標題
    const centerX = canvas.width / 2;
    let cursorY = 120;

    // 主標題
    ctx.font = `bold 60px ${style.font}`;
    ctx.fillStyle = style.titleColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${storeName}美容室 ${month}月公休表`, centerX, cursorY);
    
    cursorY += 70;

    // 副標題
    const subPart1 = "目前美容室為一人作業，採";
    const subPart2 = "預約制"; // 重點文字
    const subPart3 = "，請務必提前預約";
    
    const baseFontSize = 28;
    const highlightFontSize = 34; 
    
    ctx.font = `bold ${baseFontSize}px ${style.font}`;
    const w1 = ctx.measureText(subPart1).width;
    const w3 = ctx.measureText(subPart3).width;
    
    ctx.font = `bold ${highlightFontSize}px ${style.font}`;
    const w2 = ctx.measureText(subPart2).width;
    
    const totalW = w1 + w2 + w3;
    let currentTextX = centerX - (totalW / 2); 

    ctx.textAlign = 'left';
    ctx.font = `bold ${baseFontSize}px ${style.font}`;
    ctx.fillStyle = style.subtitleColor;
    ctx.fillText(subPart1, currentTextX, cursorY);
    currentTextX += w1;

    ctx.font = `bold ${highlightFontSize}px ${style.font}`;
    ctx.fillStyle = style.highlightColor; 
    ctx.fillText(subPart2, currentTextX, cursorY);
    currentTextX += w2;

    ctx.font = `bold ${baseFontSize}px ${style.font}`;
    ctx.fillStyle = style.subtitleColor;
    ctx.fillText(subPart3, currentTextX, cursorY);

    cursorY += 60; 

    // 3. 月曆
    const gridWidth = canvas.width - (ANNOUNCE_CONFIG.padding * 2);
    const cellWidth = gridWidth / 7;
    const cellHeight = 120; 
    const gridStartX = ANNOUNCE_CONFIG.padding;
    const gridStartY = cursorY;

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    ctx.fillStyle = style.footerBg; 
    roundRect(ctx, gridStartX, gridStartY, gridWidth, 50, 10, true, false); 
    ctx.fill();

    ctx.font = `bold 24px ${style.font}`;
    ctx.fillStyle = style.footerText;
    ctx.textAlign = 'center';
    weekDays.forEach((day, index) => {
        ctx.fillText(day, gridStartX + (cellWidth * index) + (cellWidth / 2), gridStartY + 35);
    });

    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); 
    const daysInMonth = new Date(year, month, 0).getDate(); 

    let currentDay = 1;
    let currentX = gridStartX + (firstDayOfMonth * cellWidth);
    let currentY = gridStartY + 50; 
    let col = firstDayOfMonth;

    const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthOffDays = currentDaysOff
        .filter(d => d.startsWith(currentMonthPrefix))
        .map(d => parseInt(d.split('-')[2])); 

    ctx.strokeStyle = style.gridBorder;
    ctx.lineWidth = 2;

    for (let i = 0; i < 6; i++) { 
        for (let j = col; j < 7; j++) {
            if (currentDay > daysInMonth) break;

            ctx.strokeRect(currentX, currentY, cellWidth, cellHeight);

            ctx.font = `bold 24px ${style.font}`;
            ctx.fillStyle = style.dayNumber;
            ctx.textAlign = 'left';
            ctx.fillText(currentDay, currentX + 10, currentY + 30);

            if (monthOffDays.includes(currentDay)) {
                ctx.font = `bold 48px ${style.font}`;
                ctx.fillStyle = style.offText;
                ctx.textAlign = 'center';
                ctx.fillText("公休", currentX + (cellWidth / 2), currentY + (cellHeight / 2) + 15);
            }

            currentDay++;
            currentX += cellWidth;
        }
        if (currentDay > daysInMonth) break;
        col = 0; 
        currentX = gridStartX;
        currentY += cellHeight;
    }

    // 4. 空白區備註
    const footerStartY = canvas.height - 240; 
    if (renderOptions.extraNote) {
        const gapCenterY = currentY + (footerStartY - currentY) / 2;
        
        ctx.font = `bold 42px ${style.font}`; 
        ctx.fillStyle = style.extraNoteColor; 
        ctx.textAlign = 'center';
        
        const lines = renderOptions.extraNote.split('\n');
        const lineHeight = 60;
        const totalTextHeight = lines.length * lineHeight;
        let textY = gapCenterY - (totalTextHeight / 2) + (lineHeight / 3);

        lines.forEach(line => {
            ctx.fillText(line, centerX, textY);
            textY += lineHeight;
        });
    }

    // 5. 底部資訊
    const footerHeight = 240;
    ctx.fillStyle = style.footerBg;
    ctx.fillRect(0, footerStartY, canvas.width, footerHeight);

    ctx.fillStyle = style.footerText;
    ctx.textAlign = 'left';
    ctx.font = `bold 32px ${style.font}`;
    
    const textStartX = 100;
    const lineHeight = 50;
    let textY = footerStartY + 60;

    if(renderOptions.line1) { ctx.fillText(renderOptions.line1, textStartX, textY); textY += lineHeight; }
    if(renderOptions.line2) { ctx.fillText(renderOptions.line2, textStartX, textY); textY += lineHeight; }
    if(renderOptions.line3) { ctx.fillText(renderOptions.line3, textStartX, textY); textY += lineHeight; }
    if(renderOptions.line4) { ctx.fillText(renderOptions.line4, textStartX, textY); }
}

function roundRect(ctx, x, y, width, height, radius, topOnly = false, fill = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    if(topOnly) {
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x, y + radius);
    } else {
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
    }
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// 模式1: 填滿 (Cover) - 修改：圖片一律置頂 (startY = 0)
function drawCoverImage(ctx, img, w, h) {
    const prop = img.width / img.height;
    const ctxProp = w / h;
    let drawW, drawH, startX, startY;
    if (prop > ctxProp) {
        // 圖片比較寬：高度填滿，水平置中，垂直本來就是滿的所以置頂
        drawH = h; drawW = h * prop; startX = (w - drawW) / 2; startY = 0;
    } else {
        // 圖片比較高：寬度填滿，垂直改為置頂 (原為置中)
        drawW = w; drawH = w / prop; startX = 0; 
        // startY = (h - drawH) / 2; // 置中代碼 (已註解)
        startY = 0; // 強制置頂
    }
    ctx.drawImage(img, startX, startY, drawW, drawH);
}

// 模式2: 完整顯示 (Contain) - 修改：圖片一律置頂
function drawContainImage(ctx, img, w, h) {
    const scale = Math.min(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const startX = (w - drawW) / 2;
    // const startY = (h - drawH) / 2; // 置中代碼 (已註解)
    const startY = 0; // 強制置頂
    ctx.drawImage(img, startX, startY, drawW, drawH);
}

function downloadAnnouncement() {
    const canvas = document.getElementById(ANNOUNCE_CONFIG.canvasId);
    const link = document.createElement('a');
    const storeName = document.getElementById('current-store-name') ? document.getElementById('current-store-name').innerText : '店鋪';
    const month = currentDate.getMonth() + 1;
    link.download = `${storeName}_${month}月公休表.png`;
    link.href = canvas.toDataURL();
    link.click();
}
