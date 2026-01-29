/**
 * 公休公告生成器 (最終穩定版 + 字型支援)
 * 包含：智慧欄位讀取 + 圖片強制置頂 + 完整顯示模式 + 額外備註 + 新年預設圖 + 安全渲染機制 + 字型選擇
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

// 字型定義
const FONT_MAP = {
    'default': 'Noto Sans TC, sans-serif',
    'QingFeng': 'QingFeng, cursive',
    'HuiWen': 'HuiWen, serif'
};

const FONT_FILES = {
    'QingFeng': '清風手寫體5.ttf',
    'HuiWen': '匯文正楷.ttf'
};

let currentTemplateType = 'regular';
let customBgImage = null;
let currentFontFamily = FONT_MAP['default']; // 當前使用的字型

let renderOptions = {
    textColorMode: 'dark',
    line1: '', line2: '', line3: '', line4: '',
    extraNote: '' 
};

function initAnnouncementGenerator() {
    const fileInput = document.getElementById('announce-bg-upload');
    const fontSelect = document.getElementById('announce-font-select');

    if (fontSelect) {
        fontSelect.addEventListener('change', async function(e) {
            const selectedKey = e.target.value;
            await loadCustomFont(selectedKey);
            currentFontFamily = FONT_MAP[selectedKey] || FONT_MAP['default'];
            drawAnnouncement();
        });
    }

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
                // 若在新年版按下清除，重新載入預設圖；常規版則清空
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

// 載入自訂字型
async function loadCustomFont(fontKey) {
    if (fontKey === 'default' || !FONT_FILES[fontKey]) return;

    const fontName = fontKey; // 內部識別名 (例如 QingFeng)
    const fontUrl = FONT_FILES[fontKey]; // 檔案名 (例如 清風手寫體5.ttf)

    // 檢查是否已經載入
    const isLoaded = document.fonts.check(`12px "${fontName}"`);
    if (isLoaded) return;

    try {
        const font = new FontFace(fontName, `url(${fontUrl})`);
        await font.load();
        document.fonts.add(font);
        console.log(`字型 ${fontName} 載入成功`);
    } catch (e) {
        console.warn(`字型 ${fontName} 載入失敗 (請確認 ${fontUrl} 存在)`, e);
        // 不做額外處理，Canvas 會自動 fallback 到系統字型
    }
}

function openAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // --- 自動填入分店資料 (智慧搜尋版) ---
        if (typeof allStores !== 'undefined' && currentStoreId) {
            const store = allStores.find(s => s.id === currentStoreId);
            if (store) {
                // console.log("公告生成器 - 原始資料:", store); 

                // 智慧取值函式：會嘗試多種可能的欄位名稱
                const findValue = (possibleKeys) => {
                    for (let key of possibleKeys) {
                        // 1. 直接比對
                        if (store[key] !== undefined && store[key] !== '') return store[key];
                        
                        // 2. 去除空白並轉小寫後比對 (防止 Excel 欄位有空白鍵)
                        const target = key.replace(/\s/g, '').toLowerCase();
                        for (let storeKey in store) {
                            if (storeKey.replace(/\s/g, '').toLowerCase() === target) {
                                if (store[storeKey]) return store[storeKey];
                            }
                        }
                    }
                    return '';
                };

                // 同時搜尋中文與英文 Key，確保萬無一失
                const phone = findValue(['預約專線', 'phone', 'phoneNo', 'tel']);
                const line = findValue(['LINE官方帳號', 'lineId', 'line']);
                const fb = findValue(['FACEBOOK官方專頁', 'fbPage', 'fb']);
                const hours = findValue(['營業時間', 'displayHours', 'businessHours']);

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

    // 清空手動上傳的 Input 顯示
    if(fileInput) fileInput.value = '';

    if (type === 'newyear') {
        // 先繪製一次（顯示漸層背景與文字），避免載入圖片時畫面空白
        customBgImage = null; // 暫時清空
        if(fitCheckbox) fitCheckbox.checked = true; // 新年版預設完整顯示
        drawAnnouncement();

        // 載入預設背景
        const img = new Image();
        img.onload = function() { 
            customBgImage = img; 
            drawAnnouncement(); 
        };
        // 確保 background02.jpg 在同目錄下
        img.src = 'background02.jpg'; 
    } else {
        // 常規版：清除背景圖，恢復漸層
        customBgImage = null; 
        if(fitCheckbox) fitCheckbox.checked = false; 
        updateRenderOptions();
    }
}

function drawAnnouncement() {
    try {
        const canvas = document.getElementById(ANNOUNCE_CONFIG.canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        canvas.width = ANNOUNCE_CONFIG.width;
        canvas.height = ANNOUNCE_CONFIG.height;

        const style = ANNOUNCE_CONFIG.styles[currentTemplateType];
        const storeName = document.getElementById('current-store-name') ? document.getElementById('current-store-name').innerText : '美容預約';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        // 決定使用的字體
        const useFont = currentFontFamily || style.font;

        // 1. 繪製背景 (先畫漸層底色)
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, style.bgGradient[0]);
        grad.addColorStop(1, style.bgGradient[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 如果有自訂圖片 (或新年預設圖)，再疊上去
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
        ctx.font = `bold 60px ${useFont}`;
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
        
        ctx.font = `bold ${baseFontSize}px ${useFont}`;
        const w1 = ctx.measureText(subPart1).width;
        const w3 = ctx.measureText(subPart3).width;
        
        ctx.font = `bold ${highlightFontSize}px ${useFont}`;
        const w2 = ctx.measureText(subPart2).width;
        
        const totalW = w1 + w2 + w3;
        let currentTextX = centerX - (totalW / 2); 

        ctx.textAlign = 'left';
        ctx.font = `bold ${baseFontSize}px ${useFont}`;
        ctx.fillStyle = style.subtitleColor;
        ctx.fillText(subPart1, currentTextX, cursorY);
        currentTextX += w1;

        ctx.font = `bold ${highlightFontSize}px ${useFont}`;
        ctx.fillStyle = style.highlightColor; 
        ctx.fillText(subPart2, currentTextX, cursorY);
        currentTextX += w2;

        ctx.font = `bold ${baseFontSize}px ${useFont}`;
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

        ctx.font = `bold 24px ${useFont}`;
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

        // 安全取得公休資料 (防止變數未定義導致崩潰)
        const daysOffList = (typeof currentDaysOff !== 'undefined') ? currentDaysOff : [];
        const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthOffDays = daysOffList
            .filter(d => d && d.startsWith(currentMonthPrefix))
            .map(d => parseInt(d.split('-')[2])); 

        ctx.strokeStyle = style.gridBorder;
        ctx.lineWidth = 2;

        for (let i = 0; i < 6; i++) { 
            for (let j = col; j < 7; j++) {
                if (currentDay > daysInMonth) break;

                ctx.strokeRect(currentX, currentY, cellWidth, cellHeight);

                ctx.font = `bold 24px ${useFont}`;
                ctx.fillStyle = style.dayNumber;
                ctx.textAlign = 'left';
                ctx.fillText(currentDay, currentX + 10, currentY + 30);

                if (monthOffDays.includes(currentDay)) {
                    ctx.font = `bold 48px ${useFont}`;
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
            
            ctx.font = `bold 42px ${useFont}`; 
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
        ctx.font = `bold 32px ${useFont}`;
        
        const textStartX = 100;
        const lineHeight = 50;
        let textY = footerStartY + 60;

        if(renderOptions.line1) { ctx.fillText(renderOptions.line1, textStartX, textY); textY += lineHeight; }
        if(renderOptions.line2) { ctx.fillText(renderOptions.line2, textStartX, textY); textY += lineHeight; }
        if(renderOptions.line3) { ctx.fillText(renderOptions.line3, textStartX, textY); textY += lineHeight; }
        if(renderOptions.line4) { ctx.fillText(renderOptions.line4, textStartX, textY); }
    } catch (e) {
        console.error("繪製公告時發生錯誤:", e);
    }
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
        startY = 0; // 強制置頂，不垂直置中
    }
    ctx.drawImage(img, startX, startY, drawW, drawH);
}

// 模式2: 完整顯示 (Contain) - 修改：圖片一律置頂
function drawContainImage(ctx, img, w, h) {
    const scale = Math.min(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const startX = (w - drawW) / 2;
    const startY = 0; // 強制置頂，下方留白
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
