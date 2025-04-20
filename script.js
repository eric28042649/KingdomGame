// --- 常數定義 ---
// !!! 重要：請確認這是您正確的 Worker URL !!!
const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/'; // 請替換成您的 Worker URL
const GAME_STATE_KEY = 'kingdomGameState_v5'; // sessionStorage key for game state
const HISTORY_KEY = 'kingdomGameHistory_v5';   // sessionStorage key for limited history
const MAX_HISTORY_TURNS = 100; // 保存的回合數

// --- DOMContentLoaded 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    // 根據路徑初始化對應的畫面
    if (path === '' || path === 'index.html' || path === 'start-screen.html') {
        initStartScreen();
    } else if (path === 'main-game.html') {
        initMainGameScreen();
    } else if (path === 'feedback-screen.html') {
        initFeedbackScreen();
    } else if (path === 'game-over-screen.html') {
        initGameOverScreen();
    } else {
        console.warn("無法識別的頁面路徑:", window.location.pathname);
        navigateTo('index.html'); // 無法識別則跳回首頁
    }
});

// --- Helper 函數 ---

/**
 * 向後端 Worker 發送請求
 * @param {{ playerAction?: object, limitedHistory?: Array<{role: string, parts: Array<{text: string}>}> } | null} payload - 發送給後端的數據
 * @returns {Promise<object>} - 解析後的 gameState JSON 物件
 * @throws {Error} - 請求失敗或回應格式錯誤時拋出
 */
async function callBackend(payload = null) {
    showLoading(true); // 顯示載入提示
    console.log("呼叫後端 (v5)，Payload:", payload);
    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined, // 如果有 payload 就轉成 JSON 字串
        };
        const response = await fetch(WORKER_URL, requestOptions); // 發送請求

        // 檢查回應狀態
        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try {
                // 嘗試解析錯誤回應的 JSON 內容
                const errorData = await response.json();
                errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`;
            } catch (e) { /* 解析錯誤回應失敗，忽略 */ }
            throw new Error(errorDetails); // 拋出包含狀態碼和錯誤訊息的 Error
        }

        const gameState = await response.json(); // 解析回應的 JSON

        // 驗證回應是否包含頂層 gameState 鍵
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵:", gameState);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }
        console.log("從後端收到 gameState (v5):", gameState);
        return gameState; // 返回解析後的 gameState 物件
    } catch (error) {
        console.error("呼叫後端時發生錯誤 (v5):", error);
        // 重新拋出錯誤，以便上層可以捕獲
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        showLoading(false); // 無論成功或失敗，都隱藏載入提示
    }
}

/**
 * 儲存遊戲狀態到 sessionStorage
 * @param {object} gameState - 要儲存的遊戲狀態物件 (包含頂層 gameState)
 */
function saveGameState(gameState) {
    // 驗證 gameState 的基本結構
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("嘗試儲存無效的 gameState:", gameState);
        return; // 不儲存無效狀態
    }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存。");
    } catch (error) {
        console.error("儲存遊戲狀態失敗:", error);
        displayError("無法儲存遊戲進度。"); // 提示使用者
    }
}

/**
 * 從 sessionStorage 讀取遊戲狀態
 * @returns {object | null} - 讀取到的遊戲狀態物件，若無或無效則返回 null
 */
function loadGameState() {
    try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) {
            console.log("SessionStorage 中沒有找到遊戲狀態。");
            return null; // 沒有儲存的狀態
        }
        const gameState = JSON.parse(gameStateString); // 解析 JSON 字串

        // 驗證讀取到的 gameState 結構
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("從 SessionStorage 讀取的 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY); // 移除無效狀態
             return null;
        }
        console.log("從 sessionStorage 成功讀取遊戲狀態。");
        return gameState; // 返回有效的 gameState 物件
    } catch (error) {
        console.error("讀取遊戲狀態失敗:", error);
        displayError("無法讀取遊戲進度。"); // 提示使用者
        sessionStorage.removeItem(GAME_STATE_KEY); // 移除可能損壞的狀態
        return null;
    }
}

/**
 * 儲存對話歷史到 sessionStorage (限制長度)
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history - 完整的對話歷史陣列
 */
function saveHistory(history) {
    if (!Array.isArray(history)) {
        console.warn("嘗試儲存非陣列的歷史記錄");
        return;
    }
    try {
        // 限制歷史記錄的長度
        const limitedHistory = history.slice(-MAX_HISTORY_TURNS);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
        console.log(`對話歷史已儲存 (${limitedHistory.length} / ${MAX_HISTORY_TURNS} 條)。`);
    } catch (error) {
        console.error("儲存對話歷史失敗:", error);
        displayError("無法儲存對話歷史。"); // 提示使用者
    }
}

/**
 * 從 sessionStorage 讀取對話歷史
 * @returns {Array<{role: string, parts: Array<{text: string}>}>} - 歷史陣列，若無或無效則返回空陣列
 */
function loadHistory() {
    try {
        const historyString = sessionStorage.getItem(HISTORY_KEY);
        if (!historyString) {
            console.log("SessionStorage 中沒有找到對話歷史。");
            return []; // 沒有歷史記錄，返回空陣列
        }
        const history = JSON.parse(historyString); // 解析 JSON 字串

        // 驗證讀取到的歷史記錄是否為陣列
        if (!Array.isArray(history)) {
             console.error("從 SessionStorage 讀取的歷史記錄格式非陣列:", history);
             sessionStorage.removeItem(HISTORY_KEY); // 移除無效歷史
             return [];
        }
        console.log(`從 sessionStorage 成功讀取 ${history.length} 條歷史記錄。`);
        return history; // 返回有效的歷史陣列
    } catch (error) {
        console.error("讀取對話歷史失敗:", error);
        displayError("無法讀取對話歷史。"); // 提示使用者
        sessionStorage.removeItem(HISTORY_KEY); // 移除可能損壞的歷史
        return [];
    }
}


/**
 * 導航到指定頁面
 * @param {string} page - 目標頁面的文件名 (e.g., 'index.html')
 */
function navigateTo(page) {
    console.log(`準備導航到: ${page}`);
    showLoading(false); // 確保載入提示已隱藏
    window.location.href = page; // 執行頁面跳轉
}

/**
 * 顯示/隱藏全局載入提示
 * @param {boolean} show - true 為顯示，false 為隱藏
 */
function showLoading(show) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none'; // 控制顯示/隱藏
        } else if (show) {
            // 如果需要顯示但找不到元素，發出警告
            console.warn("找不到 ID 為 'loadingIndicator' 的元素。");
        }
    } catch (e) {
        console.error("控制載入提示時出錯:", e);
    }
}

/**
 * 顯示錯誤訊息給使用者 (使用 alert)
 * @param {string} message - 要顯示的錯誤訊息
 */
function displayError(message) {
    console.error("遊戲錯誤:", message); // 在控制台記錄詳細錯誤
    alert(`發生錯誤：\n${message}`); // 使用 alert 彈窗提示使用者
}

// --- UI 更新函數 ---

/**
 * 更新主遊戲畫面的 UI 元素
 * @param {object} gameState - 包含當前遊戲狀態的物件
 */
function updateMainUI(gameState) {
    // 驗證 gameState 基本結構
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("updateMainUI 收到無效的 gameState", gameState);
        navigateTo('index.html'); // 跳轉回首頁
        return;
    }
    const state = gameState.gameState; // 提取核心狀態
    console.log("更新主 UI，回合:", state.roundNumber);

    // 更新回合數和資源顯示
    setTextContent('roundNumber', state.roundNumber ?? '--'); // 使用 nullish coalescing 處理可能的 null/undefined
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);

    // 更新事件描述和階段指示器
    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    if (eventDescElement) {
         if (state.currentEvent?.description) {
            const description = state.currentEvent.description;
            // 嘗試使用 marked.js 渲染 Markdown (如果可用)
            if (typeof marked !== 'undefined' && marked.parse) {
                try {
                    eventDescElement.innerHTML = marked.parse(description); // 渲染 Markdown
                } catch (e) {
                    console.error("Markdown 解析錯誤:", e);
                    eventDescElement.textContent = description; // 解析失敗則顯示原始文本
                }
            } else {
                eventDescElement.textContent = description; // 沒有 marked.js 則顯示原始文本
            }
        } else {
            eventDescElement.textContent = '目前沒有特殊事件。'; // 沒有事件時的提示
        }
    }
    if (eventStageElement) {
        // 顯示或隱藏事件階段指示器
        if (state.currentEvent?.stage) {
            eventStageElement.textContent = `(階段 ${state.currentEvent.stage})`;
            eventStageElement.style.display = 'block';
        } else {
            eventStageElement.style.display = 'none';
        }
    }

    // 更新選項按鈕
    const options = state.currentEvent?.options || []; // 獲取選項陣列，若無則為空陣列
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        const optionTextElement = document.getElementById(`option${optionId}Text`);
        const optionData = options.find(opt => opt.id === optionId); // 查找對應的選項數據

        if (button && optionTextElement) {
            if (optionData && optionData.text) {
                // 如果有選項數據且文本不為空
                optionTextElement.textContent = optionData.text; // 設置選項文字
                button.disabled = false; // 啟用按鈕
                button.style.display = 'flex'; // 顯示按鈕
            } else {
                // 如果沒有對應的選項數據或文本為空
                optionTextElement.textContent = ''; // 清空文字
                button.disabled = true; // 禁用按鈕
                button.style.display = 'none'; // 隱藏按鈕
            }
        }
    });

    // 更新狀態訊息
    setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
}

/**
 * 填充反饋畫面的內容
 * @param {object} gameState - 包含遊戲狀態和上回合結果的物件
 */
function populateFeedbackScreen(gameState) {
    // 驗證 gameState 和 lastChoiceResult
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("populateFeedbackScreen 收到無效的 gameState", gameState);
        navigateTo('index.html'); return;
    }
    const state = gameState.gameState;
    if (!state.lastChoiceResult) {
        console.error("populateFeedbackScreen 缺少 lastChoiceResult!", gameState);
        // 如果缺少必要的回饋信息，也跳回首頁，避免顯示不完整或錯誤的畫面
        navigateTo('index.html');
        return;
    }
    console.log("填充反饋畫面，上回合選擇:", state.lastChoiceResult.chosenOptionId);

    // 獲取必要的 DOM 元素
    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeArea = document.getElementById('outcomeArea');
    const outcomeText = document.getElementById('outcomeText');
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const initialStateArea = document.getElementById('initialStateArea'); // 初始狀態區塊 (通常隱藏)
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber');

    // 確保所有元素都存在
    if (!feedbackTitle || !outcomeArea || !outcomeText || !resourceChangesArea || !resourceChangesList || !initialStateArea || !continueButton || !nextRoundNumberSpan) {
        console.error("反饋介面元素缺失！");
        navigateTo('index.html'); // 缺少元素則跳回首頁
        return;
    }

    // 預設隱藏初始狀態區，顯示結果和資源變動區
    initialStateArea.style.display = 'none';
    outcomeArea.style.display = 'block';
    resourceChangesArea.style.display = 'block';

    // 設置標題和結果描述
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`; // 回合數是進入下一回合的編號，所以減 1
    outcomeText.textContent = state.lastChoiceResult.outcomeText || '影響已產生。'; // 結果描述，提供預設值

    // 清空並填充資源變動列表
    resourceChangesList.innerHTML = ''; // 清空舊列表
    const changes = state.lastChoiceResult.resourceChanges || {}; // 獲取資源變動，若無則為空物件
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' }; // 資源名稱映射

    for (const key in resourceMap) {
         if (Object.hasOwnProperty.call(resourceMap, key)) { // 確保是自身屬性
            const changeValue = changes[key] || 0; // 獲取變動值，預設為 0
            const li = document.createElement('li'); // 創建列表項

            // 根據變動值設置樣式類別
            let changeClass = 'change-neutral'; // 預設為中性
            if (changeValue > 0) { changeClass = 'change-positive'; } // 正向變動
            else if (changeValue < 0) { changeClass = 'change-negative'; } // 負向變動
            li.className = changeClass;

            // 設置列表項文本（顯示絕對值）
            li.textContent = `${resourceMap[key]}: ${Math.abs(changeValue)}`;
            resourceChangesList.appendChild(li); // 添加到列表中
        }
     }

    // 更新繼續按鈕的文本
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;
}

/**
 * 填充遊戲結束畫面的內容
 * @param {object} gameState - 包含遊戲結束狀態的物件
 */
function populateGameOverScreen(gameState) {
    // 驗證 gameState 和 gameOver 狀態
     if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) {
        console.error("populateGameOverScreen 收到無效的 gameState 或遊戲未結束", gameState);
        navigateTo('index.html'); // 不符合條件則跳回首頁
        return;
     }
    const gameOverState = gameState.gameState.gameOver; // 提取遊戲結束狀態
    console.log("填充遊戲結束畫面。");

    // 設置結局文本和最終回合數
    setTextContent('endingText', gameOverState.endingText || '統治結束。'); // 結局描述，提供預設值
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--'); // 最終回合數
}

/**
 * 輔助函數：設置指定 ID 元素的文本內容
 * @param {string} id - 目標元素的 ID
 * @param {string | number} text - 要設置的文本內容
 */
function setTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text; // 設置文本
    } else {
        console.warn(`找不到 ID 為 "${id}" 的元素。`); // 元素不存在時發出警告
    }
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一)
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v5)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) { console.error("找不到開始按鈕！"); return; } // 找不到按鈕直接返回

    // 清除舊的遊戲狀態和歷史記錄，確保全新開始
    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
    console.log("已清除舊的遊戲狀態和歷史。");

    // 為開始按鈕添加點擊事件監聽器
    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5)");
        startButton.disabled = true; // 防止重複點擊
        try {
            // 第一次調用後端，payload 為 null，獲取初始遊戲狀態
            const initialGameState = await callBackend(null);
            saveGameState(initialGameState); // 儲存初始狀態
            // 初始歷史為空，不需要儲存 saveHistory([])
            navigateTo('main-game.html'); // 導航到主遊戲畫面
        } catch (error) {
            // 處理開始遊戲時的錯誤
            displayError(`無法開始遊戲：${error.message || error}`);
            startButton.disabled = false; // 發生錯誤時重新啟用按鈕
        }
    });
    console.log("開始畫面初始化完畢。");
}

/**
 * 初始化反饋畫面 (介面三)
 */
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v5)...");
    const gameState = loadGameState(); // 讀取當前狀態

    // 驗證讀取的狀態是否有效
    if (!gameState || !gameState.gameState) {
        console.log("反饋畫面：找不到有效的遊戲狀態，導航回首頁。");
        navigateTo('index.html');
        return;
    }
    // 如果遊戲已結束，直接跳轉到結束畫面
    if (gameState.gameState.gameOver?.isOver) {
        console.log("反饋畫面：遊戲已結束，導航到結束畫面。");
        navigateTo('game-over-screen.html');
        return;
    }
    // 驗證是否存在上回合結果，這是反饋畫面的必要數據
    if (!gameState.gameState.lastChoiceResult) {
        console.error("反饋畫面缺少 lastChoiceResult! 可能狀態異常，導航回首頁。", gameState);
        // 清除可能異常的狀態
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }

    populateFeedbackScreen(gameState); // 使用有效狀態填充畫面內容

    const continueButton = document.getElementById('continueButton');
    if (!continueButton) { console.error("找不到繼續按鈕！"); return; } // 找不到按鈕直接返回

    // 為繼續按鈕添加點擊事件監聽器
    continueButton.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v5)");
        // 導航到主遊戲畫面，開始下一回合
        // 不需要重新加載狀態，因為主遊戲畫面會自己加載
        navigateTo('main-game.html');
    });
    console.log("反饋畫面初始化完畢。");
}

/**
 * 初始化主遊戲畫面 (介面二)
 */
function initMainGameScreen() {
    console.log("初始化主遊戲畫面 (v5)...");
    const gameState = loadGameState(); // 讀取當前狀態

    // 驗證讀取的狀態是否有效，或遊戲是否已結束
    if (!gameState || !gameState.gameState || gameState.gameState.gameOver?.isOver) {
        console.log("主遊戲畫面：找不到有效狀態或遊戲已結束，清除狀態並導航回首頁。");
        // 清除狀態並跳回首頁
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }

    updateMainUI(gameState); // 使用有效狀態更新畫面顯示

    // 為選項按鈕添加事件監聽器
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        // 只為當前可用的按鈕添加監聽器
        if (button && !button.disabled) {
            button.addEventListener('click', async (event) => {
                const chosenOptionId = event.currentTarget.dataset.choice; // 獲取被點擊的選項 ID
                console.log(`選項 ${chosenOptionId} 被點擊 (v5)`);

                // 禁用所有選項按鈕，防止重複提交
                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true); // 顯示載入提示

                // --- **核心修改：準備有限歷史和 Payload** ---
                // 1. 準備玩家行動的內容 (用於歷史記錄)
                const playerAction = { playerAction: { chosenOptionId: chosenOptionId } };
                const playerActionTurn = {
                    role: 'user',
                    // 將行動物件轉為字串存入歷史的 parts
                    parts: [{ text: JSON.stringify(playerAction) }]
                };

                // 2. 讀取當前的對話歷史
                let currentHistory = loadHistory();

                // 3. 準備發送給後端的有限歷史 (最多 MAX_HISTORY_TURNS - 1 條)
                //    因為 playerActionTurn 會在 Worker 端被加到 history 之後
                const historyToSend = currentHistory.slice(-(MAX_HISTORY_TURNS - 1)); // 取最後 N-1 條

                try {
                    // 4. 準備 payload，包含行動物件和有限歷史陣列
                    const payload = {
                        playerAction: playerAction,      // 玩家行動物件本身
                        limitedHistory: historyToSend    // 有限的歷史記錄陣列
                    };

                    // 5. 呼叫後端
                    const newGameState = await callBackend(payload); // newGameState 包含頂層 gameState

                    // --- !!! 偵錯點 !!! ---
                    // console.log("【偵錯】收到後端回應 newGameState:", JSON.stringify(newGameState, null, 2));
                    // 在這裡暫停，讓您可以在開發者工具中檢查 newGameState 的值
                    // 請確保您的瀏覽器開發者工具是打開的 (按 F12)
                    debugger;
                    // --- !!! 偵錯點結束 !!! ---


                    // 6. 更新持久化的對話歷史
                    currentHistory.push(playerActionTurn); // 先加入玩家行動
                    // 檢查模型回應是否正確，再加入歷史
                    if (newGameState && newGameState.gameState) {
                        currentHistory.push({ // 再加入模型回應 (完整的 gameState 字串)
                            role: 'model',
                            // 將包含 gameState 的物件轉為字串存入歷史的 parts
                            parts: [{ text: JSON.stringify(newGameState) }]
                        });
                    } else {
                        console.error("【警告】後端未返回有效的 gameState，模型回應未添加到歷史中。");
                    }
                    // 限制歷史總長度 (saveHistory 內部會處理)
                    saveHistory(currentHistory); // 儲存更新後的歷史陣列

                    // 7. 儲存最新的 gameState 物件 (用於下一頁 UI 更新)
                    // 再次檢查 newGameState 有效性
                    if (newGameState && newGameState.gameState) {
                        saveGameState(newGameState);
                    } else {
                         console.error("【錯誤】後端未返回有效的 gameState，無法儲存狀態。");
                         // 可以在此處添加更明確的錯誤處理或提示
                         displayError("從伺服器獲取的遊戲狀態無效，無法繼續。");
                         // 重新啟用按鈕，讓使用者可以嘗試其他操作或刷新
                         document.querySelectorAll('.option-card').forEach(btn => btn.disabled = false);
                         showLoading(false);
                         return; // 終止後續導航
                    }


                    // 8. 導航到反饋畫面 (如果遊戲未結束)
                    //   或者導航到結束畫面 (如果遊戲結束)
                    if (newGameState.gameState.gameOver?.isOver) {
                         console.log("遊戲已結束，導航到結束畫面。");
                         navigateTo('game-over-screen.html');
                    } else {
                         console.log("導航到反饋畫面。");
                         navigateTo('feedback-screen.html');
                    }


                } catch (error) {
                    // 處理選項點擊過程中的錯誤 (例如 callBackend 失敗)
                    console.error("處理選項點擊時發生錯誤 (v5):", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || error}`);
                    // 重新啟用選項按鈕，讓使用者可以重試
                    document.querySelectorAll('.option-card').forEach(btn => btn.disabled = false);
                    showLoading(false); // 隱藏載入提示
                }
                // --- **核心修改結束** ---
            });
        }
    });
    console.log("主遊戲畫面初始化完畢。");
}


/**
 * 初始化遊戲結束畫面 (介面四)
 */
function initGameOverScreen() {
    console.log("初始化遊戲結束畫面 (v5)...");
    const gameState = loadGameState(); // 讀取狀態

    // 驗證狀態是否有效且確實是遊戲結束狀態
     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        console.log("結束畫面：找不到有效狀態或遊戲未結束，清除狀態並導航回首頁。");
        // 清除可能殘留的無效狀態
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }

    populateGameOverScreen(gameState); // 填充結束畫面內容

    const playAgainButton = document.getElementById('playAgainButton');
    if (!playAgainButton) { console.error("找不到重新開始按鈕！"); return; } // 找不到按鈕直接返回

    // 為重新開始按鈕添加點擊事件監聽器
    playAgainButton.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5)");
        // 清除所有遊戲狀態和歷史記錄
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html'); // 導航回開始畫面
    });
    console.log("遊戲結束畫面初始化完畢。");
}
