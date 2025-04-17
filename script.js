/**
 * 王國沉浮錄 - 遊戲前端邏輯
 * 遵循方案 A (介面切換)
 */

// --- 常數定義 ---
// !!! 重要：請替換成您 Cloudflare Worker 的實際 URL !!!
const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/';
const GAME_STATE_KEY = 'kingdomGameState'; // sessionStorage 中儲存遊戲狀態的鍵值

// --- DOMContentLoaded 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();

    // 根據檔名初始化對應的頁面邏輯
    if (path === '' || path === 'index.html' || path === 'start-screen.html') {
        initStartScreen();
    } else if (path === 'main-game.html') {
        initMainGameScreen();
    } else if (path === 'feedback-screen.html') {
        initFeedbackScreen();
    } else if (path === 'game-over-screen.html') {
        initGameOverScreen();
    } else {
        console.warn("無法識別的頁面路徑:", window.location.pathname, "將嘗試導向開始頁面。");
        navigateTo('index.html');
    }
});

// --- Helper 函數 ---

/**
 * 向後端 Worker 發送請求
 * @param {object | null} payload - 要發送的數據，格式為 { playerAction?: object, previousState?: object } 或 null
 * @returns {Promise<object>} - 解析後的 gameState JSON 物件 (包含頂層 gameState 鍵)
 * @throws {Error} - 如果請求失敗或回應格式錯誤
 */
async function callBackend(payload = null) {
    showLoading(true);
    console.log("呼叫後端，Payload:", payload); // 除錯：顯示發送的內容
    try {
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 只有在 payload 非 null 時才加入 body
            body: payload ? JSON.stringify(payload) : undefined,
        };

        const response = await fetch(WORKER_URL, requestOptions);

        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try {
                // 嘗試解析 Worker 返回的錯誤訊息
                const errorData = await response.json();
                errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`;
            } catch (e) { /* 解析錯誤訊息失敗則忽略 */ }
            throw new Error(errorDetails);
        }

        const gameState = await response.json();
        // 驗證基本結構
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵:", gameState);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }
        console.log("從後端收到 gameState:", gameState); // 除錯用
        return gameState;

    } catch (error) {
        console.error("呼叫後端時發生錯誤:", error);
        // 確保錯誤訊息被正確拋出
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        showLoading(false);
    }
}

/**
 * 將遊戲狀態儲存到 sessionStorage
 * @param {object} gameState - 要儲存的遊戲狀態物件 (包含頂層 gameState 鍵)
 */
function saveGameState(gameState) {
    if (!gameState || typeof gameState !== 'object') {
        console.error("嘗試儲存無效的 gameState:", gameState);
        return;
    }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存至 sessionStorage");
    } catch (error) {
        console.error("儲存遊戲狀態失敗:", error);
        displayError("無法儲存遊戲進度，請檢查瀏覽器設定。");
    }
}

/**
 * 從 sessionStorage 讀取遊戲狀態
 * @returns {object | null} - 遊戲狀態物件，如果不存在或解析失敗則返回 null
 */
function loadGameState() {
    try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) {
            console.log("SessionStorage 中沒有找到遊戲狀態。");
            return null;
        }
        const gameState = JSON.parse(gameStateString);
        // 再次驗證讀取出的結構
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("從 SessionStorage 讀取的 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY); // 清除無效狀態
             return null;
        }
        console.log("從 sessionStorage 成功讀取遊戲狀態。");
        return gameState;
    } catch (error) {
        console.error("讀取遊戲狀態失敗:", error);
        displayError("無法讀取遊戲進度，可能需要重新開始。");
        sessionStorage.removeItem(GAME_STATE_KEY); // 清除可能損壞的狀態
        return null;
    }
}

/**
 * 導航到指定頁面
 * @param {string} page - 目標頁面的檔名
 */
function navigateTo(page) {
    console.log(`準備導航到: ${page}`);
    showLoading(false); // 確保載入提示已隱藏
    window.location.href = page;
}

/**
 * 顯示/隱藏全局載入提示
 * @param {boolean} show - true 顯示, false 隱藏
 */
function showLoading(show) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        } else if (show) {
            // 如果某頁面沒有載入指示器但需要顯示，可以在控制台提示
            console.warn("嘗試顯示載入提示，但找不到 ID 為 'loadingIndicator' 的元素。");
        }
    } catch (e) {
        console.error("控制載入提示時出錯:", e);
    }
}


/**
 * 顯示錯誤訊息給使用者
 * @param {string} message - 要顯示的錯誤訊息
 */
function displayError(message) {
    console.error("遊戲錯誤:", message);
    // 暫時使用 alert，建議後續替換為更友善的 UI 提示
    alert(`發生錯誤：\n${message}`);
}

// --- UI 更新函數 ---

/**
 * 更新主遊戲介面 (介面二) 的元素
 * @param {object} gameState - 包含頂層 gameState 鍵的物件
 */
function updateMainUI(gameState) {
    // 驗證傳入的 gameState 結構
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("傳遞給 updateMainUI 的 gameState 無效:", gameState);
        displayError("無法更新遊戲畫面，遊戲狀態遺失。");
        navigateTo('index.html'); // 返回開始頁面
        return;
    }
    const state = gameState.gameState; // 提取內部的狀態物件

    console.log("正在更新主遊戲 UI，回合:", state.roundNumber);

    // 更新回合數
    setTextContent('roundNumber', state.roundNumber ?? '--');

    // 更新資源
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);

    // 更新事件描述
    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    if (eventDescElement) {
        if (state.currentEvent?.description) {
            const description = state.currentEvent.description;
            // 使用 Marked.js 渲染 Markdown
            if (typeof marked !== 'undefined' && marked.parse) {
                try {
                    // 注意：如果擔心 XSS，應使用 DOMPurify 過濾
                    // eventDescElement.innerHTML = DOMPurify.sanitize(marked.parse(description));
                    eventDescElement.innerHTML = marked.parse(description);
                } catch (e) {
                    console.error("Markdown 解析錯誤:", e);
                    eventDescElement.textContent = description; // Fallback
                }
            } else {
                eventDescElement.textContent = description; // Fallback
            }
        } else {
            eventDescElement.textContent = '目前沒有特殊事件。';
        }
    }
     // 更新階段指示
    if (eventStageElement) {
        if (state.currentEvent?.stage) {
            eventStageElement.textContent = `(階段 ${state.currentEvent.stage})`;
            eventStageElement.style.display = 'block';
        } else {
            eventStageElement.style.display = 'none';
        }
    }

    // 更新選項按鈕
    const options = state.currentEvent?.options || [];
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        const optionTextElement = document.getElementById(`option${optionId}Text`);
        const optionData = options.find(opt => opt.id === optionId);

        if (button && optionTextElement) {
            if (optionData && optionData.text) { // 確保有文字內容
                optionTextElement.textContent = optionData.text;
                button.disabled = false;
                button.style.display = 'flex'; // 使用 flex 保持佈局一致性
            } else {
                // 如果沒有這個選項的數據，則隱藏按鈕
                optionTextElement.textContent = ''; // 清空文字
                button.disabled = true;
                button.style.display = 'none';
            }
        }
    });

    // 更新狀態訊息
    setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
}

/**
 * 填充反饋介面 (介面三) 的內容 (已移除初始狀態邏輯)
 * @param {object} gameState - 包含頂層 gameState 鍵的物件
 */
function populateFeedbackScreen(gameState) {
    // 驗證 gameState 結構
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("傳遞給 populateFeedbackScreen 的 gameState 無效:", gameState);
        displayError("無法顯示回合結果，遊戲狀態遺失。");
        navigateTo('index.html');
        return;
    }
    const state = gameState.gameState;

    // 驗證 lastChoiceResult 是否存在 (關鍵檢查)
    if (!state.lastChoiceResult) {
        console.error("錯誤：進入反饋畫面時，gameState 中缺少 lastChoiceResult！", state);
        displayError("無法顯示上一回合結果，資料缺失，將返回開始畫面。");
        sessionStorage.removeItem(GAME_STATE_KEY); // 清除可能錯誤的狀態
        navigateTo('index.html');
        return;
    }

    console.log("正在填充反饋畫面，上一回合選擇:", state.lastChoiceResult.chosenOptionId);

    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeArea = document.getElementById('outcomeArea');
    const outcomeText = document.getElementById('outcomeText');
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const initialStateArea = document.getElementById('initialStateArea'); // 雖然不用，但還是獲取一下
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber');

    // 檢查所有必要的 HTML 元素是否存在
    if (!feedbackTitle || !outcomeArea || !outcomeText || !resourceChangesArea || !resourceChangesList || !initialStateArea || !continueButton || !nextRoundNumberSpan) {
        console.error("反饋介面的部分 HTML 元素缺失！");
        displayError("頁面結構錯誤，無法顯示反饋。");
        return;
    }

    // --- 顯示回合結果 ---
    // (隱藏初始狀態區，顯示結果區 - 確保 CSS 中 initialStateArea 預設是 display:none)
    initialStateArea.style.display = 'none';
    outcomeArea.style.display = 'block';
    resourceChangesArea.style.display = 'block';

    // 設定標題
    // 注意：state.roundNumber 是 *下一回合* 的編號，所以結果是 (roundNumber - 1) 回合的
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`;

    // 填充結果描述
    outcomeText.textContent = state.lastChoiceResult.outcomeText || '您的行動產生了一些影響。';

    // 填充資源變動列表
    resourceChangesList.innerHTML = ''; // 清空舊列表
    const changes = state.lastChoiceResult.resourceChanges || {};
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };

    for (const key in resourceMap) {
        if (Object.hasOwnProperty.call(resourceMap, key)) { // 確保是自身屬性
            const changeValue = changes[key] || 0; // 預設變化為 0
            const li = document.createElement('li');
            let changeClass = 'change-neutral';
            if (changeValue > 0) {
                changeClass = 'change-positive';
            } else if (changeValue < 0) {
                changeClass = 'change-negative';
            }
            li.className = changeClass; // 使用 className 一次性設定 class
            // 使用 textContent 避免 XSS
            li.textContent = `${resourceMap[key]}: ${Math.abs(changeValue)}`; // 符號由 CSS 控制
            resourceChangesList.appendChild(li);
        }
    }

    // 更新繼續按鈕文字
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;
}


/**
 * 填充遊戲結束介面 (介面四) 的內容
 * @param {object} gameState - 包含頂層 gameState 鍵的物件
 */
function populateGameOverScreen(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) {
        console.error("傳遞給 populateGameOverScreen 的 gameState 無效或遊戲未結束:", gameState);
        displayError("無法顯示遊戲結束畫面，遊戲狀態錯誤。");
        navigateTo('index.html');
        return;
    }
    const gameOverState = gameState.gameState.gameOver;

    console.log("正在填充遊戲結束畫面。");

    setTextContent('endingText', gameOverState.endingText || '您的統治走到了終點。');
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--'); // 使用 ?? 提供預設值
}


// --- 輔助函數：安全地設定元素的 textContent ---
// (修改以支持更新資源值的 span)
function setTextContent(id, text, isResource = false) {
    const element = document.getElementById(id);
    if (element) {
        if (isResource) {
            // 對於資源，我們假設結構是 <span class="resource" id="..."><icon> <span class="resource-value"></span></span>
            // 或者像之前那樣直接設定整個 span 的 textContent
            // 為了簡單起見，我們先直接設定整個 span
             element.textContent = text;
             // 如果需要只更新數字，可以這樣：
             // const valueElement = element.querySelector('.resource-value');
             // if (valueElement) { valueElement.textContent = text.split(' ')[1] || text; }
             // else { element.textContent = text; }
        } else {
            element.textContent = text;
        }
    } else {
        console.warn(`找不到 ID 為 "${id}" 的元素來設定文字內容。`);
    }
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一) - 更新版
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v2)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) {
        console.error("找不到開始按鈕！");
        return;
    }
    // 清除可能存在的舊狀態，確保全新開始
    sessionStorage.removeItem(GAME_STATE_KEY);
    console.log("已清除舊的遊戲狀態。");

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v2)");
        startButton.disabled = true;
        try {
            console.log("準備呼叫後端獲取初始狀態...");
            // 發送初始請求 (payload 為 null)
            const initialGameState = await callBackend(null);
            console.log("收到初始狀態，準備儲存...");
            saveGameState(initialGameState); // 儲存初始狀態
            console.log("準備導航到主遊戲畫面...");
            navigateTo('main-game.html'); // <<< 直接導航到介面二

        } catch (error) {
            console.error("處理開始按鈕點擊時出錯:", error);
            displayError(`無法開始遊戲：${error.message || error}`);
            startButton.disabled = false; // 出錯時重新啟用按鈕
        }
    });
    console.log("開始畫面初始化完畢。");
}

/**
 * 初始化反饋畫面 (介面三) - 更新版
 */
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v2)...");
    const gameState = loadGameState();
    // 檢查狀態是否存在且有效
    if (!gameState || !gameState.gameState) {
        console.warn("在反饋頁面找不到有效的遊戲狀態，返回開始頁面。");
        navigateTo('index.html');
        return;
    }
    // 檢查遊戲是否已結束 (雖然理論上結束時會去介面四，但加個保險)
     if (gameState.gameState.gameOver?.isOver) {
        console.warn("在反饋頁面讀取到遊戲已結束的狀態，導向結束畫面。");
        navigateTo('game-over-screen.html');
        return;
    }

    // 在這個流程版本中，進入此頁面時 lastChoiceResult 必定不為 null
    // populateFeedbackScreen 會處理顯示結果和檢查 lastChoiceResult 是否存在
    populateFeedbackScreen(gameState);

    const continueButton = document.getElementById('continueButton');
    if (!continueButton) {
        console.error("找不到繼續按鈕！");
        return;
    }

    continueButton.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v2)");
        const currentState = loadGameState(); // 再次讀取最新的狀態
        if (!currentState || !currentState.gameState) {
             console.error("點擊繼續時無法讀取狀態！");
             navigateTo('index.html');
             return;
        }

        // 檢查是否遊戲結束
        if (currentState.gameState.gameOver?.isOver) {
            console.log("遊戲已結束，導向結束畫面。");
            navigateTo('game-over-screen.html');
        } else {
            // 遊戲繼續，導航回主遊戲畫面進行下一回合
            console.log("遊戲繼續，導向主遊戲畫面。");
            navigateTo('main-game.html');
        }
    });
    console.log("反饋畫面初始化完畢。");
}

/**
 * 初始化主遊戲畫面 (介面二) - 更新版 (需要傳遞 previousState)
 */
function initMainGameScreen() {
    console.log("初始化主遊戲畫面 (v2)...");
    const gameState = loadGameState();
    // 檢查狀態是否存在且有效，且遊戲未結束
    if (!gameState || !gameState.gameState || gameState.gameState.gameOver?.isOver) {
        console.warn("在主遊戲頁面找不到有效遊戲狀態或遊戲已結束，返回開始頁面。");
        sessionStorage.removeItem(GAME_STATE_KEY);
        navigateTo('index.html');
        return;
    }

    updateMainUI(gameState); // 根據讀取的狀態更新畫面

    // 為選項按鈕添加事件監聽器
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button && !button.disabled) { // 只為可用的按鈕添加監聽器
            button.addEventListener('click', async (event) => {
                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v2)`);

                // 禁用所有按鈕並顯示載入
                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true);

                // 獲取當前的狀態作為 previousState
                const currentState = loadGameState();
                if (!currentState) {
                    console.error("無法讀取當前狀態來發送請求！");
                    displayError("發生內部錯誤，無法處理您的選擇。");
                    showLoading(false);
                    document.querySelectorAll('.option-card').forEach(btn => btn.disabled = false); // 重新啟用
                    return;
                }

                try {
                    // 準備包含玩家選擇和上一狀態的 payload
                    const payload = {
                        playerAction: { chosenOptionId: chosenOptionId },
                        previousState: currentState // <<< 將當前狀態作為 previousState 發送
                    };
                    // 發送請求到後端
                    const newGameState = await callBackend(payload);
                    saveGameState(newGameState); // 儲存後端返回的新狀態
                    navigateTo('feedback-screen.html'); // 導航到反饋頁面顯示結果

                } catch (error) {
                    console.error("處理選項點擊時發生錯誤:", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || error}`);
                    // 出錯時，重新啟用按鈕並隱藏載入
                    document.querySelectorAll('.option-card').forEach(btn => btn.disabled = false);
                    showLoading(false);
                }
            });
        }
    });
    console.log("主遊戲畫面初始化完畢。");
}

/**
 * 初始化遊戲結束畫面 (介面四) - 保持不變
 */
function initGameOverScreen() {
    console.log("初始化遊戲結束畫面 (v2)...");
    const gameState = loadGameState();
     // 檢查狀態是否存在且有效，且遊戲確實結束
     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        console.warn("在遊戲結束頁面找不到有效遊戲狀態或遊戲未結束，返回開始頁面。");
        sessionStorage.removeItem(GAME_STATE_KEY);
        navigateTo('index.html');
        return;
    }

    populateGameOverScreen(gameState); // 填充結束資訊

    const playAgainButton = document.getElementById('playAgainButton');
    if (!playAgainButton) {
        console.error("找不到重新開始按鈕！");
        return;
    }

    playAgainButton.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v2)");
        sessionStorage.removeItem(GAME_STATE_KEY); // 清除遊戲狀態
        navigateTo('index.html'); // 返回開始頁面
    });
    console.log("遊戲結束畫面初始化完畢。");
}