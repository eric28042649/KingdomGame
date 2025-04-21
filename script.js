// --- 常數定義 ---
const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/'; // 請替換成您的 Worker URL
const GAME_STATE_KEY = 'kingdomGameState_v5';
const HISTORY_KEY = 'kingdomGameHistory_v5';
const MAX_HISTORY_TURNS = 100;
const TYPEWRITER_SPEED = 50; // 打字機效果速度 (毫秒/字)
const OPTION_REVEAL_DELAY = 150; // 選項依序顯示延遲 (毫秒)
const FEEDBACK_REVEAL_DELAY = 200; // Feedback 畫面元素顯示延遲
const GAMEOVER_REVEAL_DELAY = 300; // GameOver 畫面元素顯示延遲
const RESOURCE_MIN = 0; // 資源最小值 (觸發結束)
const RESOURCE_MAX = 10; // 資源最大值 (觸發結束)
const INITIAL_RESOURCES = { people: 5, army: 5, treasury: 5, faith: 5 }; // 定義初始資源

// --- 全局變數 ---
let typewriterInterval = null; // 用於追蹤打字機效果的計時器

// --- DOMContentLoaded 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    console.log(`[DOMContentLoaded] Path: ${path || 'index.html'}`);
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

// (callBackend, applyResourceChanges, checkGameOver, saveGameState, loadGameState, saveHistory, loadHistory, navigateTo, showLoading, displayError, setTextContent, typewriterEffect 保持不變)
async function callBackend(payload = null) {
    showLoading(true);
    console.log("呼叫後端 (v5.4)，Payload:", payload ? {
        chosenOptionId: payload.playerAction?.chosenOptionId,
        currentStateRound: payload.currentState?.roundNumber,
        historyLength: payload.limitedHistory?.length
     } : null);
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
        const backendResponseData = await response.json();
        if (!backendResponseData || typeof backendResponseData !== 'object' || !backendResponseData.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵 (v5.4):", backendResponseData);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }
        console.log("從後端收到回應 (v5.4):", backendResponseData);
        return backendResponseData;
    } catch (error) {
        console.error("呼叫後端時發生錯誤 (v5.4):", error);
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        showLoading(false);
    }
}
function applyResourceChanges(currentResources, changes) {
    const newResources = { ...(currentResources || INITIAL_RESOURCES) }; // 如果初始為 null，使用預設值
    const resourceKeys = ['people', 'army', 'treasury', 'faith'];
    for (const key of resourceKeys) {
        if (changes && typeof changes[key] === 'number') {
            newResources[key] = (newResources[key] || 0) + changes[key];
            newResources[key] = Math.max(RESOURCE_MIN, Math.min(RESOURCE_MAX, newResources[key]));
        } else if (typeof newResources[key] !== 'number'){
             newResources[key] = 5;
             console.warn(`資源 ${key} 值無效或未提供變化，已重設為 5。`);
        }
    }
    console.log("資源變化應用後:", newResources, "變化量:", changes);
    return newResources;
}
function checkGameOver(resources) {
    if (!resources) return { isOver: false, reason: null }; // 如果 resources 為空，則遊戲未結束
    const resourceKeys = ['people', 'army', 'treasury', 'faith'];
    for (const key of resourceKeys) {
        // 確保比較的是數字
        const value = resources[key];
        if (typeof value !== 'number') {
             console.warn(`檢查遊戲結束時資源 ${key} 不是數字: ${value}`);
             continue; // 跳過無效資源
        }
        if (value <= RESOURCE_MIN) {
            console.log(`遊戲結束：資源 ${key} (${value}) 歸零。`);
            return { isOver: true, reason: `${key}_zero` };
        }
        if (value >= RESOURCE_MAX) {
            console.log(`遊戲結束：資源 ${key} (${value}) 溢滿。`);
            return { isOver: true, reason: `${key}_max` };
        }
    }
    return { isOver: false, reason: null };
}
function saveGameState(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) { console.error("嘗試儲存無效的 gameState:", gameState); return; }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存 (前端計算後)。");
    } catch (error) { console.error("儲存遊戲狀態失敗:", error); displayError("無法儲存遊戲進度。");}
}
function loadGameState() {
    try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) { console.log("SessionStorage 中沒有找到遊戲狀態。"); return null; }
        const gameState = JSON.parse(gameStateString);
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("從 SessionStorage 讀取的 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY); return null;
        }
        return gameState;
    } catch (error) { console.error("讀取遊戲狀態失敗:", error); displayError("無法讀取遊戲進度。"); sessionStorage.removeItem(GAME_STATE_KEY); return null;}
}
function saveHistory(history) {
    if (!Array.isArray(history)) { console.warn("嘗試儲存非陣列的歷史記錄"); return; }
    try {
        const limitedHistory = history.slice(-MAX_HISTORY_TURNS);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
        console.log(`對話歷史已儲存 (${limitedHistory.length} / ${MAX_HISTORY_TURNS} 條)。`);
    } catch (error) { console.error("儲存對話歷史失敗:", error); displayError("無法儲存對話歷史。");}
}
function loadHistory() {
    try {
        const historyString = sessionStorage.getItem(HISTORY_KEY);
        if (!historyString) { console.log("SessionStorage 中沒有找到對話歷史。"); return []; }
        const history = JSON.parse(historyString);
        if (!Array.isArray(history)) {
             console.error("從 SessionStorage 讀取的歷史記錄格式非陣列:", history);
             sessionStorage.removeItem(HISTORY_KEY); return [];
        }
        return history;
    } catch (error) { console.error("讀取對話歷史失敗:", error); displayError("無法讀取對話歷史。"); sessionStorage.removeItem(HISTORY_KEY); return []; }
}
function navigateTo(page) {
    console.log(`[Navigate] 準備導航到: ${page}`);
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
    }
    showLoading(false);
    window.location.href = page;
}
function showLoading(show) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) indicator.style.display = show ? 'flex' : 'none';
        else if (show) console.warn("找不到 ID 為 'loadingIndicator' 的元素。");
    } catch (e) { console.error("控制載入提示時出錯:", e); }
}
function displayError(message) {
    console.error("遊戲錯誤:", message);
    alert(`發生錯誤：\n${message}`);
}
function setTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`setTextContent: 找不到 ID 為 "${id}" 的元素。`);
    }
}
function typewriterEffect(element, text, speed, callback) {
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
    }
    if (!element) { console.error("Typewriter effect called with null element."); return; }
    if (typeof text !== 'string') {
        console.warn(`Typewriter effect called with non-string text: ${text}. Using empty string.`);
        text = '';
    }
    element.textContent = '';
    let i = 0;

    if (document.body.querySelector('.game-container')) {
         document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
    } else if (document.body.querySelector('.feedback-container')) {
        const continueBtn = document.getElementById('continueButton');
        if (continueBtn) continueBtn.disabled = true;
    } else if (document.body.querySelector('.game-over-container')) {
        const playAgainBtn = document.getElementById('playAgainButton');
        if (playAgainBtn) playAgainBtn.disabled = true;
    }

    typewriterInterval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
            if ((element.id === 'eventDescription' || element.id === 'outcomeText' || element.id === 'endingText') && typeof marked !== 'undefined' && marked.parse) {
                 try {
                     const originalText = element.textContent;
                     element.innerHTML = marked.parse(originalText);
                 }
                 catch (e) { console.error("打字機效果後 Markdown 解析錯誤:", e); }
            }
            if (callback) {
                try { callback(); }
                catch(callbackError) {
                    console.error(`Error executing typewriter callback for #${element.id}:`, callbackError);
                    displayError(`顯示後續內容時發生錯誤: ${callbackError.message}`);
                }
            }
        }
    }, speed);
}


// --- UI 更新函數 ---

// (updateMainUI, populateFeedbackScreen, populateGameOverScreen 保持不變)
function updateMainUI(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("updateMainUI 收到無效的 gameState", gameState);
        navigateTo('index.html');
        return;
    }
    const state = gameState.gameState;
    console.log("更新主 UI，回合:", state.roundNumber);

    setTextContent('roundNumber', state.roundNumber ?? '--');
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);

    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    const optionsArea = document.querySelector('.options-area');

    if (optionsArea) optionsArea.style.visibility = 'hidden';
    if (eventStageElement) eventStageElement.style.display = 'none';

    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
            button.style.opacity = '0';
            button.style.transform = 'translateY(10px)';
            button.disabled = true;
        }
    });

    if (eventDescElement) {
        const descriptionText = state.currentEvent?.description || '目前沒有特殊事件。';
        const afterTypingCallback = () => {
            if (eventStageElement) {
                if (state.currentEvent?.stage) {
                    eventStageElement.textContent = `(階段 ${state.currentEvent.stage})`;
                    eventStageElement.style.display = 'block';
                } else {
                    eventStageElement.style.display = 'none';
                }
            }
            const options = state.currentEvent?.options || [];
            const optionButtons = ['A', 'B', 'C']
                .map(id => document.getElementById(`option${id}`))
                .filter(btn => btn !== null);
            if (optionsArea) optionsArea.style.visibility = 'visible';
            let delay = 0;
            optionButtons.forEach((button) => {
                const optionId = button.id.replace('option', '');
                const optionTextElement = document.getElementById(`option${optionId}Text`);
                const optionData = options.find(opt => opt.id === optionId);
                if (optionTextElement && optionData && optionData.text) {
                    optionTextElement.textContent = optionData.text;
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0px)';
                        button.disabled = false;
                    }, delay);
                    delay += OPTION_REVEAL_DELAY;
                } else if (button) {
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(10px)';
                    button.disabled = true;
                }
            });
             setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
        };
        typewriterEffect(eventDescElement, descriptionText, TYPEWRITER_SPEED, afterTypingCallback);
    } else {
        console.warn("找不到 ID 為 'eventDescription' 的元素。");
        setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
    }
}
function populateFeedbackScreen(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("populateFeedbackScreen 收到無效的 gameState", gameState);
        navigateTo('index.html'); return null;
    }
    const state = gameState.gameState;
    if (!state.lastChoiceResult || !state.lastChoiceResult.chosenOptionId || !state.lastChoiceResult.resourceChanges) {
        console.error("populateFeedbackScreen 的 lastChoiceResult 結構不完整!", state.lastChoiceResult);
        if (!state.lastChoiceResult?.resourceChanges) {
             navigateTo('index.html'); return null;
        }
    }
    console.log("填充反饋畫面，上回合選擇:", state.lastChoiceResult.chosenOptionId);

    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeTextElement = document.getElementById('outcomeText');
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const initialStateArea = document.getElementById('initialStateArea');
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber');
    if (!feedbackTitle || !outcomeTextElement || !resourceChangesArea || !resourceChangesList || !initialStateArea || !continueButton || !nextRoundNumberSpan) {
        console.error("反饋介面元素缺失！"); navigateTo('index.html'); return null;
    }

    initialStateArea.style.display = 'none';
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`;
    const outcomeString = state.lastChoiceResult.outcomeText || '影響已產生。';

    resourceChangesList.innerHTML = '';
    const changes = state.lastChoiceResult.resourceChanges || {};
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };
    let hasChanges = false;
    for (const key in resourceMap) {
         if (Object.hasOwnProperty.call(changes, key)) {
            const changeValue = changes[key] || 0;
            const li = document.createElement('li');
            let changeClass = 'change-neutral';
            if (changeValue > 0) { changeClass = 'change-positive'; hasChanges = true; }
            else if (changeValue < 0) { changeClass = 'change-negative'; hasChanges = true; }
            li.className = changeClass;
            li.textContent = `${resourceMap[key]}: ${Math.abs(changeValue)}`;
            resourceChangesList.appendChild(li);
        }
     }
     if (!hasChanges) {
         const li = document.createElement('li');
         li.textContent = "資源無明顯變化。";
         resourceChangesList.appendChild(li);
     }

    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;

    return outcomeString;
}
function populateGameOverScreen(gameState) {
     if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) {
        console.error("populateGameOverScreen 收到無效的 gameState 或遊戲未結束", gameState);
        navigateTo('index.html'); return null;
     }
    const gameOverState = gameState.gameState.gameOver;
    console.log("填充遊戲結束畫面靜態內容...");

    const endingString = gameOverState.endingText || '統治結束。';
    if (typeof endingString !== 'string') {
        console.error("Ending text is not a string:", endingString);
        return '統治結束。';
    }
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--');

    return endingString;
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一) - 修正：設定初始資源和回合數
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v5.4)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) { console.error("找不到開始按鈕！"); return; }

    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
    console.log("已清除舊的遊戲狀態和歷史。");

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5.4)");
        startButton.disabled = true;
        try {
            console.log("[StartGame] 正在調用 callBackend(null)...");
            const backendResponse = await callBackend(null); // 獲取包含事件和選項效果的回應
            console.log("[StartGame] 從後端收到 backendResponse:", JSON.stringify(backendResponse, null, 2));

            // **驗證後端回應的基本結構**
            if (!backendResponse || !backendResponse.gameState || !backendResponse.gameState.currentEvent) {
                throw new Error("從後端獲取的初始遊戲狀態無效 (缺少 gameState 或 currentEvent)。");
            }
            const stateFromAI = backendResponse.gameState; // AI 生成的內容 (主要是 currentEvent)

            // **驗證 AI 生成的 currentEvent 結構**
            if (!Array.isArray(stateFromAI.currentEvent.options) || stateFromAI.currentEvent.options.length === 0) {
                 throw new Error("初始事件缺少 options 陣列或選項為空。");
            }
            const optionsValid = stateFromAI.currentEvent.options.every((opt, index) => {
                const hasChanges = opt && typeof opt.resourceChanges === 'object' && opt.resourceChanges !== null;
                if (!hasChanges) console.error(`[StartGame Validation] 選項 ${index} (ID: ${opt?.id}) 缺少有效的 resourceChanges。`, opt);
                return hasChanges;
            });
            if (!optionsValid) {
                 throw new Error("初始事件的部分選項缺少 resourceChanges 數據。請檢查後端 AI 是否按要求返回。");
            }
            console.log("[StartGame] 後端返回的 initial currentEvent 驗證通過。");

            // **構建完整的初始 gameState (前端設定)**
            const initialGameState = {
                gameState: {
                    roundNumber: 1, // **前端設定初始回合數**
                    resources: { ...INITIAL_RESOURCES }, // **前端設定初始資源 (使用深拷貝)**
                    currentEvent: stateFromAI.currentEvent, // 使用 AI 生成的事件
                    lastChoiceResult: null, // 初始為 null
                    gameOver: { isOver: false, reason: null, endingText: null, finalRounds: null }, // **前端設定初始 gameOver 狀態**
                    statusMessage: stateFromAI.statusMessage || "您的統治開始了..." // 使用 AI 的訊息或預設值
                }
            };
            console.log("[StartGame] 構建的完整 initialGameState:", JSON.stringify(initialGameState, null, 2));

            // 儲存構建好的完整初始狀態
            console.log("[StartGame] 正在儲存 gameState...");
            saveGameState(initialGameState);
            console.log("[StartGame] gameState 儲存完畢。");

            // 將初始狀態存入歷史
            try {
                console.log("[StartGame] 正在儲存初始歷史...");
                const initialModelTurn = {
                    role: 'model',
                    // **儲存包含前端設定值的完整狀態**
                    parts: [{ text: JSON.stringify(initialGameState) }]
                };
                saveHistory([initialModelTurn]);
                console.log("[StartGame] 初始歷史儲存完畢。");
            } catch (historyError) {
                console.error("儲存初始歷史記錄時出錯:", historyError);
                displayError("無法儲存初始遊戲歷史，可能影響後續遊戲。");
            }

            // 導航到主遊戲畫面
            console.log("[StartGame] 準備導航到 main-game.html...");
            navigateTo('main-game.html');

        } catch (error) {
            console.error("[StartGame] 處理點擊時發生錯誤:", error);
            displayError(`無法開始遊戲：${error.message || '未知錯誤'}`);
            startButton.disabled = false;
        }
    });
    console.log("開始畫面初始化完畢。");
}

// (initFeedbackScreen, initGameOverScreen 保持不變)
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v5.4)...");
    const gameState = loadGameState();

    if (!gameState || !gameState.gameState) { navigateTo('index.html'); return; }
    if (!gameState.gameState.lastChoiceResult) { console.error("反饋畫面缺少 lastChoiceResult!"); navigateTo('index.html'); return; }

    const outcomeTextElement = document.getElementById('outcomeText');
    const resourceChangesAreaElement = document.getElementById('resourceChangesArea');
    const continueButtonElement = document.getElementById('continueButton');

    if (!outcomeTextElement || !resourceChangesAreaElement || !continueButtonElement) {
        console.error("Feedback 畫面缺少必要的 UI 元素！");
        navigateTo('index.html');
        return;
    }

    const outcomeStringToType = populateFeedbackScreen(gameState);
    if (outcomeStringToType === null) return;

    resourceChangesAreaElement.style.opacity = '0';
    resourceChangesAreaElement.style.transform = 'translateY(10px)';
    resourceChangesAreaElement.style.visibility = 'hidden';
    continueButtonElement.style.opacity = '0';
    continueButtonElement.style.transform = 'translateY(10px)';
    continueButtonElement.style.visibility = 'hidden';
    continueButtonElement.disabled = true;

    const showFeedbackDetails = () => {
        if (resourceChangesAreaElement) {
            resourceChangesAreaElement.style.visibility = 'visible';
            setTimeout(() => {
                resourceChangesAreaElement.style.opacity = '1';
                resourceChangesAreaElement.style.transform = 'translateY(0px)';
            }, 10);
        } else { console.warn("Callback: resourceChangesAreaElement not found."); }

        if (continueButtonElement) {
             setTimeout(() => {
                continueButtonElement.style.visibility = 'visible';
                continueButtonElement.style.opacity = '1';
                continueButtonElement.style.transform = 'translateY(0px)';
                continueButtonElement.disabled = false;
             }, FEEDBACK_REVEAL_DELAY);
        } else { console.warn("Callback: continueButtonElement not found."); }
    };

    typewriterEffect(outcomeTextElement, outcomeStringToType, TYPEWRITER_SPEED, showFeedbackDetails);

    continueButtonElement.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v5.4)");
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        navigateTo('main-game.html');
    });

    console.log("反饋畫面初始化完畢。");
}
function initGameOverScreen() {
    console.log("--- 初始化遊戲結束畫面 (v5.4) ---");
    const gameState = loadGameState();

     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        console.error("結束畫面：找不到有效狀態或遊戲未結束。GameState:", gameState);
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }
    console.log("有效的 Game Over 狀態:", JSON.stringify(gameState.gameState.gameOver, null, 2));

    console.log("正在獲取 GameOver 畫面元素...");
    const endingTextElement = document.getElementById('endingText');
    const finalStatsElement = document.querySelector('.final-stats');
    const playAgainButtonElement = document.getElementById('playAgainButton');

    if (!endingTextElement) console.error("找不到元素: #endingText");
    if (!finalStatsElement) console.error("找不到元素: .final-stats");
    if (!playAgainButtonElement) console.error("找不到元素: #playAgainButton");

    if (!endingTextElement || !finalStatsElement || !playAgainButtonElement) {
        console.error("GameOver 畫面缺少必要的 UI 元素！導航回首頁。");
        navigateTo('index.html');
        return;
    }
    console.log("所有 GameOver 畫面元素已找到。");

    console.log("正在調用 populateGameOverScreen...");
    const endingStringToType = populateGameOverScreen(gameState);
    console.log("populateGameOverScreen 返回的 endingStringToType:", endingStringToType);

    if (endingStringToType === null) {
        console.error("populateGameOverScreen 返回 null，停止初始化。");
        return;
    }
     if (typeof endingStringToType !== 'string') {
        console.error("從 populateGameOverScreen 獲取的 ending text 不是字串:", endingStringToType);
        displayError("無法獲取結局描述文字。");
        finalStatsElement.style.visibility = 'visible';
        finalStatsElement.style.opacity = '1';
        playAgainButtonElement.style.visibility = 'visible';
        playAgainButtonElement.style.opacity = '1';
        playAgainButtonElement.disabled = false;
        return;
    }

    console.log("正在初始化隱藏統計區和按鈕...");
    finalStatsElement.style.opacity = '0';
    finalStatsElement.style.transform = 'translateY(10px)';
    finalStatsElement.style.visibility = 'hidden';

    playAgainButtonElement.style.opacity = '0';
    playAgainButtonElement.style.transform = 'translateY(10px)';
    playAgainButtonElement.style.visibility = 'hidden';
    playAgainButtonElement.disabled = true;
    console.log("統計區和按鈕已初始化為隱藏。");

    const showGameOverDetails = () => {
        if (finalStatsElement) {
            finalStatsElement.style.visibility = 'visible';
            setTimeout(() => {
                finalStatsElement.style.opacity = '1';
                finalStatsElement.style.transform = 'translateY(0px)';
            }, 10);
        } else { console.warn("Callback: finalStatsElement not found."); }

        if (playAgainButtonElement) {
             setTimeout(() => {
                playAgainButtonElement.style.visibility = 'visible';
                playAgainButtonElement.style.opacity = '1';
                playAgainButtonElement.style.transform = 'translateY(0px)';
                playAgainButtonElement.disabled = false;
             }, GAMEOVER_REVEAL_DELAY);
        } else { console.warn("Callback: playAgainButtonElement not found."); }
    };

    console.log("正在啟動 typewriterEffect for endingText...");
    typewriterEffect(endingTextElement, endingStringToType, TYPEWRITER_SPEED, showGameOverDetails);

    playAgainButtonElement.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5.4)");
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
    });

    console.log("--- 遊戲結束畫面初始化完畢 ---");
}

/**
 * 初始化主遊戲畫面 (介面二) - 重大修改：前端處理核心邏輯 + 加入日誌
 */
function initMainGameScreen() {
    console.log("--- 初始化主遊戲畫面 (v5.4) ---");
    const currentFullState = loadGameState();

    console.log("[MainGame Init] 讀取的 currentFullState:", JSON.stringify(currentFullState, null, 2));
    if (!currentFullState || !currentFullState.gameState) {
        console.error("[MainGame Init] 狀態無效：缺少 gameState。導航回首頁。");
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }
    // **修正：現在初始狀態的 resources 應由前端設定，不應為 null**
    if (!currentFullState.gameState.currentEvent) {
        console.error("[MainGame Init] 狀態無效：缺少 currentEvent。導航回首頁。");
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }
     if (!currentFullState.gameState.resources) { // 驗證 resources 是否存在
        console.error("[MainGame Init] 狀態無效：缺少 resources。導航回首頁。");
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }
     if (!Array.isArray(currentFullState.gameState.currentEvent.options) || currentFullState.gameState.currentEvent.options.length === 0 || !currentFullState.gameState.currentEvent.options.every(opt => opt && typeof opt.resourceChanges === 'object')) {
        console.error("[MainGame Init] 狀態無效：currentEvent.options 結構不完整或缺少 resourceChanges。導航回首頁。", currentFullState.gameState.currentEvent.options);
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
     }

     if (currentFullState.gameState.gameOver?.isOver) {
         console.log("[MainGame Init] 檢測到遊戲已結束狀態，導航到結束畫面。");
         navigateTo('game-over-screen.html');
         return;
     }
     console.log("[MainGame Init] 狀態驗證通過。");


    updateMainUI(currentFullState);

    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
             button.addEventListener('click', async (event) => {
                 if (event.currentTarget.disabled) return;

                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v5.4)`);

                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true);

                try {
                    console.log("[Option Click] 開始前端計算...");
                    let gameStateForCalc = loadGameState();
                    if (!gameStateForCalc || !gameStateForCalc.gameState || !gameStateForCalc.gameState.currentEvent?.options) {
                        throw new Error("無法加載有效的遊戲狀態或事件選項來進行計算。");
                    }
                    let state = gameStateForCalc.gameState;
                    console.log("[Option Click] 計算前 state:", JSON.stringify(state, null, 2));

                    const chosenOption = state.currentEvent.options.find(opt => opt.id === chosenOptionId);
                    if (!chosenOption || !chosenOption.resourceChanges) {
                         console.error("[Option Click] 找不到選項或效果數據:", chosenOptionId, state.currentEvent.options);
                        throw new Error(`找不到選項 ${chosenOptionId} 或其 resourceChanges 數據。`);
                    }
                    const resourceChanges = chosenOption.resourceChanges;
                    console.log(`[Option Click] 選項 ${chosenOptionId} 的 resourceChanges:`, resourceChanges);

                    const localLastChoiceResult = {
                        chosenOptionId: chosenOptionId,
                        resourceChanges: resourceChanges,
                        outcomeText: null
                    };
                    state.lastChoiceResult = localLastChoiceResult;

                    state.resources = applyResourceChanges(state.resources, resourceChanges);

                    const previousRound = state.roundNumber;
                    state.roundNumber = (state.roundNumber || 0) + 1; // 確保 roundNumber 是數字
                    console.log(`[Option Click] 回合數遞增至 ${state.roundNumber}`);

                    const gameOverCheck = checkGameOver(state.resources);
                    state.gameOver = {
                        isOver: gameOverCheck.isOver,
                        reason: gameOverCheck.reason,
                        endingText: null,
                        finalRounds: gameOverCheck.isOver ? previousRound : null
                    };
                    console.log("[Option Click] 遊戲結束檢查結果:", state.gameOver);

                    console.log("[Option Click] 儲存中間狀態...");
                    saveGameState(gameStateForCalc);

                    // 如果遊戲已結束，直接導航，不再調用後端
                    if (state.gameOver.isOver) {
                         console.log("[Option Click] 遊戲已結束 (前端計算)，準備導航到結束畫面 (無需 AI 生成結局)。");
                         // 在這裡可以選擇是否調用 AI 獲取 endingText，或者使用預設文本
                         // 為了簡化，我們先用預設文本
                         state.gameOver.endingText = state.gameOver.endingText || "您的統治走到了終點..."; // 設置預設結局
                         saveGameState(gameStateForCalc); // 保存包含結局文本的狀態
                         navigateTo('game-over-screen.html');
                         return; // 結束處理
                    }

                    // --- 調用後端獲取文本 (遊戲未結束時) ---
                    console.log("[Option Click] 準備調用後端獲取 outcomeText 和 next event...");
                    const playerAction = { chosenOptionId: chosenOptionId };
                    const currentStateForBackend = {
                        roundNumber: state.roundNumber,
                        resources: state.resources
                    };
                    let currentHistory = loadHistory();
                    const historyToSend = currentHistory.slice(-(MAX_HISTORY_TURNS - 1));

                    const payload = { playerAction, currentState: currentStateForBackend, limitedHistory: historyToSend };

                    const backendResponse = await callBackend(payload);
                    console.log("[Option Click] 收到後端回應:", JSON.stringify(backendResponse, null, 2));


                    if (!backendResponse || !backendResponse.gameState) {
                        throw new Error("後端未返回有效的 gameState 結構。");
                    }
                    const aiResponseData = backendResponse.gameState;

                    const outcomeTextFromAI = aiResponseData.lastChoiceResult?.outcomeText;
                    const nextEventFromAI = aiResponseData.currentEvent;

                     // **再次驗證 AI 返回的下一事件**
                     if (!nextEventFromAI || !nextEventFromAI.options || !nextEventFromAI.options.every(opt => opt && typeof opt.resourceChanges === 'object')) {
                         console.error("[Option Click] 後端返回的下一事件無效或缺少選項效果:", nextEventFromAI);
                         throw new Error("後端未能提供有效的下一回合事件數據。");
                     }


                    console.log("[Option Click] 準備合併 AI 回應...");
                    let finalGameState = loadGameState();
                    if (!finalGameState || !finalGameState.gameState) {
                         throw new Error("無法加載中間狀態以合併 AI 回應。");
                    }
                    let finalState = finalGameState.gameState;

                    if (finalState.lastChoiceResult) {
                        finalState.lastChoiceResult.outcomeText = outcomeTextFromAI || "影響已產生。";
                    }
                    finalState.currentEvent = nextEventFromAI; // 更新為下一事件


                    console.log("[Option Click] 儲存最終狀態...");
                    saveGameState(finalGameState);

                    console.log("[Option Click] 更新歷史記錄...");
                    const userTurnForHistory = { role: 'user', parts: [{ text: JSON.stringify(playerAction) }] };
                    const modelTurnForHistory = { role: 'model', parts: [{ text: JSON.stringify(backendResponse) }] };
                    currentHistory.push(userTurnForHistory);
                    currentHistory.push(modelTurnForHistory);
                    saveHistory(currentHistory);

                    console.log("[Option Click] 準備導航到 feedback...");
                    navigateTo('feedback-screen.html');


                } catch (error) {
                    console.error("[Option Click] 處理選項點擊時發生嚴重錯誤 (v5.4):", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || '未知錯誤'}`);
                     document.querySelectorAll('.option-card').forEach(btn => {
                         const previousState = loadGameState();
                         const optId = btn.id.replace('option','');
                         const optData = previousState?.gameState?.currentEvent?.options?.find(o => o.id === optId);
                         if(optData && optData.text && !previousState?.gameState?.gameOver?.isOver) btn.disabled = false;
                         else btn.disabled = true;
                     });
                    showLoading(false);
                }
            });
        }
    });
    console.log("--- 主遊戲畫面初始化完畢 ---");
}
