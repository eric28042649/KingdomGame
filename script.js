// --- 常數定義 ---
// !!! 重要：請確認這是您正確的 Worker URL !!!
const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/';
const GAME_STATE_KEY = 'kingdomGameState_v5'; // sessionStorage key for game state
const HISTORY_KEY = 'kingdomGameHistory_v5';   // sessionStorage key for limited history
const MAX_HISTORY_TURNS = 100; // 保存的回合數 (4 user + 4 model = 4 rounds)

// --- DOMContentLoaded 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
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
        navigateTo('index.html');
    }
});

// --- Helper 函數 ---

/**
 * 向後端 Worker 發送請求 (修改：發送 limitedHistory 和 playerAction)
 * @param {{ playerAction?: object, limitedHistory?: Array<{role: string, parts: Array<{text: string}>}> } | null} payload
 * @returns {Promise<object>} - 解析後的 gameState JSON 物件 (包含頂層 gameState 鍵)
 * @throws {Error}
 */
async function callBackend(payload = null) {
    showLoading(true);
    console.log("呼叫後端 (v5)，Payload:", payload); // Log the payload being sent
    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined,
        };
        const response = await fetch(WORKER_URL, requestOptions);
        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try { const errorData = await response.json(); errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`; } catch (e) { /* ignore */ }
            throw new Error(errorDetails);
        }
        const gameState = await response.json();
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵:", gameState);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }
        console.log("從後端收到 gameState (v5):", gameState);
        return gameState;
    } catch (error) {
        console.error("呼叫後端時發生錯誤 (v5):", error);
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        showLoading(false);
    }
}

/**
 * 儲存遊戲狀態 (gameState 物件) 到 sessionStorage
 * @param {object} gameState
 */
function saveGameState(gameState) {
    if (!gameState || typeof gameState !== 'object') { console.error("嘗試儲存無效的 gameState:", gameState); return; }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存。");
    } catch (error) { console.error("儲存遊戲狀態失敗:", error); displayError("無法儲存遊戲進度。");}
}

/**
 * 讀取遊戲狀態 (gameState 物件) 從 sessionStorage
 * @returns {object | null}
 */
function loadGameState() {
    try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) { console.log("SessionStorage 中沒有找到遊戲狀態。"); return null; }
        const gameState = JSON.parse(gameStateString);
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("從 SessionStorage 讀取的 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY); return null;
        }
        console.log("從 sessionStorage 成功讀取遊戲狀態。");
        return gameState;
    } catch (error) { console.error("讀取遊戲狀態失敗:", error); displayError("無法讀取遊戲進度。"); sessionStorage.removeItem(GAME_STATE_KEY); return null;}
}

/**
 * 儲存對話歷史 (回合記錄陣列) 到 sessionStorage
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history
 */
function saveHistory(history) {
    if (!Array.isArray(history)) { console.warn("嘗試儲存非陣列的歷史記錄"); return; }
    try {
        // 確保 history 長度不超過 MAX_HISTORY_TURNS
        const limitedHistory = history.slice(-MAX_HISTORY_TURNS);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
        console.log(`對話歷史已儲存 (${limitedHistory.length} / ${MAX_HISTORY_TURNS} 條)。`);
    } catch (error) { console.error("儲存對話歷史失敗:", error); displayError("無法儲存對話歷史。");}
}

/**
 * 從 sessionStorage 讀取對話歷史
 * @returns {Array<{role: string, parts: Array<{text: string}>}>} - 返回歷史陣列，若無則返回空陣列
 */
function loadHistory() {
    try {
        const historyString = sessionStorage.getItem(HISTORY_KEY);
        if (!historyString) { console.log("SessionStorage 中沒有找到對話歷史。"); return []; }
        const history = JSON.parse(historyString);
        if (!Array.isArray(history)) {
             console.error("從 SessionStorage 讀取的歷史記錄格式非陣列:", history);
             sessionStorage.removeItem(HISTORY_KEY); return [];
        }
        console.log(`從 sessionStorage 成功讀取 ${history.length} 條歷史記錄。`);
        return history;
    } catch (error) { console.error("讀取對話歷史失敗:", error); displayError("無法讀取對話歷史。"); sessionStorage.removeItem(HISTORY_KEY); return []; }
}


/**
 * 導航到指定頁面
 * @param {string} page
 */
function navigateTo(page) {
    console.log(`準備導航到: ${page}`);
    showLoading(false);
    window.location.href = page;
}

/**
 * 顯示/隱藏全局載入提示
 * @param {boolean} show
 */
function showLoading(show) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) indicator.style.display = show ? 'flex' : 'none';
        else if (show) console.warn("找不到 ID 為 'loadingIndicator' 的元素。");
    } catch (e) { console.error("控制載入提示時出錯:", e); }
}

/**
 * 顯示錯誤訊息
 * @param {string} message
 */
function displayError(message) {
    console.error("遊戲錯誤:", message);
    alert(`發生錯誤：\n${message}`);
}

// --- UI 更新函數 (保持不變) ---
function updateMainUI(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) { console.error("updateMainUI gameState 無效"); navigateTo('index.html'); return; }
    const state = gameState.gameState;
    console.log("更新主 UI，回合:", state.roundNumber);
    setTextContent('roundNumber', state.roundNumber ?? '--');
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);
    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    if (eventDescElement) {
         if (state.currentEvent?.description) {
            const description = state.currentEvent.description;
            if (typeof marked !== 'undefined' && marked.parse) {
                try { eventDescElement.innerHTML = marked.parse(description); } catch (e) { console.error("Markdown 解析錯誤:", e); eventDescElement.textContent = description; }
            } else { eventDescElement.textContent = description; }
        } else { eventDescElement.textContent = '目前沒有特殊事件。'; }
    }
    if (eventStageElement) {
        if (state.currentEvent?.stage) { eventStageElement.textContent = `(階段 ${state.currentEvent.stage})`; eventStageElement.style.display = 'block'; }
        else { eventStageElement.style.display = 'none'; }
    }
    const options = state.currentEvent?.options || [];
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        const optionTextElement = document.getElementById(`option${optionId}Text`);
        const optionData = options.find(opt => opt.id === optionId);
        if (button && optionTextElement) {
            if (optionData && optionData.text) { optionTextElement.textContent = optionData.text; button.disabled = false; button.style.display = 'flex'; }
            else { optionTextElement.textContent = ''; button.disabled = true; button.style.display = 'none'; }
        }
    });
    setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
}
function populateFeedbackScreen(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) { console.error("populateFeedbackScreen gameState 無效"); navigateTo('index.html'); return; }
    const state = gameState.gameState;
    if (!state.lastChoiceResult) { console.error("populateFeedbackScreen 缺少 lastChoiceResult!"); navigateTo('index.html'); return; }
    console.log("填充反饋畫面，上回合選擇:", state.lastChoiceResult.chosenOptionId);
    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeArea = document.getElementById('outcomeArea');
    const outcomeText = document.getElementById('outcomeText');
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const initialStateArea = document.getElementById('initialStateArea');
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber');
    if (!feedbackTitle || !outcomeArea || !outcomeText || !resourceChangesArea || !resourceChangesList || !initialStateArea || !continueButton || !nextRoundNumberSpan) { console.error("反饋介面元素缺失！"); return; }
    initialStateArea.style.display = 'none';
    outcomeArea.style.display = 'block';
    resourceChangesArea.style.display = 'block';
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`;
    outcomeText.textContent = state.lastChoiceResult.outcomeText || '影響已產生。';
    resourceChangesList.innerHTML = '';
    const changes = state.lastChoiceResult.resourceChanges || {};
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };
    for (const key in resourceMap) {
         if (Object.hasOwnProperty.call(resourceMap, key)) {
            const changeValue = changes[key] || 0;
            const li = document.createElement('li');
            let changeClass = 'change-neutral';
            if (changeValue > 0) { changeClass = 'change-positive'; }
            else if (changeValue < 0) { changeClass = 'change-negative'; }
            li.className = changeClass;
            li.textContent = `${resourceMap[key]}: ${Math.abs(changeValue)}`;
            resourceChangesList.appendChild(li);
        }
     }
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;
}
function populateGameOverScreen(gameState) {
     if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) { console.error("populateGameOverScreen gameState 無效"); navigateTo('index.html'); return; }
    const gameOverState = gameState.gameState.gameOver;
    console.log("填充遊戲結束畫面。");
    setTextContent('endingText', gameOverState.endingText || '統治結束。');
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--');
}
function setTextContent(id, text) { // 簡化版
    const element = document.getElementById(id);
    if (element) element.textContent = text;
    else console.warn(`找不到 ID 為 "${id}" 的元素。`);
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一) - 更新版 v4
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v5)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) return;
    // 清除舊狀態和歷史
    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY); // <<< 清除歷史
    console.log("已清除舊的遊戲狀態和歷史。");

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5)");
        startButton.disabled = true;
        try {
            const initialGameState = await callBackend(null); // 初始請求 payload 為 null
            saveGameState(initialGameState); // 儲存初始狀態物件
            // 初始歷史為空，不需要儲存 saveHistory([])
            navigateTo('main-game.html'); // 直接導航到主遊戲畫面
        } catch (error) {
            displayError(`無法開始遊戲：${error.message || error}`);
            startButton.disabled = false;
        }
    });
    console.log("開始畫面初始化完畢。");
}

/**
 * 初始化反饋畫面 (介面三) - 基本不變 v4
 */
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v5)...");
    const gameState = loadGameState();
    if (!gameState || !gameState.gameState) { navigateTo('index.html'); return; }
    if (gameState.gameState.gameOver?.isOver) { navigateTo('game-over-screen.html'); return; }
    if (!gameState.gameState.lastChoiceResult) { console.error("反饋畫面缺少 lastChoiceResult!"); navigateTo('index.html'); return; }

    populateFeedbackScreen(gameState); // 填充畫面

    const continueButton = document.getElementById('continueButton');
    if (!continueButton) return;

    continueButton.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v5)");
        const currentState = loadGameState();
        if (!currentState || !currentState.gameState) { navigateTo('index.html'); return; }
        if (currentState.gameState.gameOver?.isOver) { navigateTo('game-over-screen.html'); }
        else { navigateTo('main-game.html'); }
    });
    console.log("反饋畫面初始化完畢。");
}

/**
 * 初始化主遊戲畫面 (介面二) - **重大修改 v4**
 */
function initMainGameScreen() {
    console.log("初始化主遊戲畫面 (v5)...");
    const gameState = loadGameState(); // 讀取當前狀態以顯示
    if (!gameState || !gameState.gameState || gameState.gameState.gameOver?.isOver) {
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }

    updateMainUI(gameState); // 更新畫面顯示當前事件/選項

    // 為選項按鈕添加事件監聽器
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button && !button.disabled) {
            button.addEventListener('click', async (event) => {
                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v5)`);

                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true);

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

                    // 6. 更新持久化的對話歷史
                    currentHistory.push(playerActionTurn); // 先加入玩家行動
                    currentHistory.push({ // 再加入模型回應 (完整的 gameState 字串)
                        role: 'model',
                        // 將包含 gameState 的物件轉為字串存入歷史的 parts
                        parts: [{ text: JSON.stringify(newGameState) }]
                    });
                    // 限制歷史總長度
                    // (saveHistory 函數內部會處理 slice)
                    saveHistory(currentHistory); // 儲存更新後的歷史陣列

                    // 7. 儲存最新的 gameState 物件 (用於下一頁 UI 更新)
                    saveGameState(newGameState);

                    // 8. 導航到反饋畫面
                    navigateTo('feedback-screen.html');

                } catch (error) {
                    console.error("處理選項點擊時發生錯誤 (v5):", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || error}`);
                    document.querySelectorAll('.option-card').forEach(btn => btn.disabled = false);
                    showLoading(false);
                }
                // --- **核心修改結束** ---
            });
        }
    });
    console.log("主遊戲畫面初始化完畢。");
}


/**
 * 初始化遊戲結束畫面 (介面四) - 更新版 v4 (增加清除歷史)
 */
function initGameOverScreen() {
    console.log("初始化遊戲結束畫面 (v5)...");
    const gameState = loadGameState();
     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }
    populateGameOverScreen(gameState);

    const playAgainButton = document.getElementById('playAgainButton');
    if (!playAgainButton) return;

    playAgainButton.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5)");
        sessionStorage.removeItem(GAME_STATE_KEY); // 清除狀態
        sessionStorage.removeItem(HISTORY_KEY); // <<< 清除歷史
        navigateTo('index.html');
    });
    console.log("遊戲結束畫面初始化完畢。");
}