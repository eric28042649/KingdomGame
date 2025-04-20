// --- 常數定義 ---
const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/'; // 請替換成您的 Worker URL
const GAME_STATE_KEY = 'kingdomGameState_v5';
const HISTORY_KEY = 'kingdomGameHistory_v5';
const MAX_HISTORY_TURNS = 100;
const TYPEWRITER_SPEED = 50; // 打字機效果速度 (毫秒/字)
const OPTION_REVEAL_DELAY = 150; // 選項依序顯示延遲 (毫秒)
const FEEDBACK_REVEAL_DELAY = 200; // Feedback 畫面元素顯示延遲
const GAMEOVER_REVEAL_DELAY = 300; // GameOver 畫面元素顯示延遲

// --- 全局變數 ---
let typewriterInterval = null; // 用於追蹤打字機效果的計時器

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
        initGameOverScreen(); // 初始化 GameOver 畫面
    } else {
        console.warn("無法識別的頁面路徑:", window.location.pathname);
        navigateTo('index.html');
    }
});

// --- Helper 函數 ---

// (callBackend, saveGameState, loadGameState, saveHistory, loadHistory, navigateTo, showLoading, displayError, typewriterEffect 保持不變)
async function callBackend(payload = null) {
    showLoading(true);
    console.log("呼叫後端 (v5)，Payload:", payload);
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
function saveGameState(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) { console.error("嘗試儲存無效的 gameState:", gameState); return; }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存。");
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
        console.log("從 sessionStorage 成功讀取遊戲狀態。");
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
        console.log(`從 sessionStorage 成功讀取 ${history.length} 條歷史記錄。`);
        return history;
    } catch (error) { console.error("讀取對話歷史失敗:", error); displayError("無法讀取對話歷史。"); sessionStorage.removeItem(HISTORY_KEY); return []; }
}
function navigateTo(page) {
    console.log(`準備導航到: ${page}`);
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
        // console.log(`Set text for #${id}: ${text}`); // 增加日誌方便追蹤
    } else {
        console.warn(`setTextContent: 找不到 ID 為 "${id}" 的元素。`);
    }
}
function typewriterEffect(element, text, speed, callback) {
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        console.log("Cleared previous typewriter interval."); // 日誌
    }
    if (!element) { // 增加對 element 的檢查
        console.error("Typewriter effect called with null element.");
        return;
    }
    if (typeof text !== 'string') { // 增加對 text 的檢查
        console.warn(`Typewriter effect called with non-string text: ${text}. Using empty string.`);
        text = '';
    }
    element.textContent = '';
    let i = 0;
    console.log(`Starting typewriter for element #${element.id}, text length: ${text.length}`); // 日誌

    // 根據當前頁面禁用對應的按鈕
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
            console.log(`Finished typewriter for element #${element.id}`); // 日誌
            // Markdown 解析
            if ((element.id === 'eventDescription' || element.id === 'outcomeText' || element.id === 'endingText') && typeof marked !== 'undefined' && marked.parse) {
                 try {
                     const originalText = element.textContent;
                     console.log(`Parsing Markdown for #${element.id}`); // 日誌
                     element.innerHTML = marked.parse(originalText);
                 }
                 catch (e) { console.error("打字機效果後 Markdown 解析錯誤:", e); }
            }
            // 執行回調
            if (callback) {
                console.log(`Executing callback for #${element.id}`); // 日誌
                try { // 包裹回調以捕獲其內部錯誤
                    callback();
                } catch(callbackError) {
                    console.error(`Error executing typewriter callback for #${element.id}:`, callbackError);
                    displayError(`顯示後續內容時發生錯誤: ${callbackError.message}`);
                }
            } else {
                console.log(`No callback provided for #${element.id}`); // 日誌
            }
        }
    }, speed);
}


// --- UI 更新函數 ---

// (updateMainUI, populateFeedbackScreen 保持不變)
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
    if (!state.lastChoiceResult) {
        console.error("populateFeedbackScreen 缺少 lastChoiceResult!", gameState);
        navigateTo('index.html'); return null;
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
        console.error("反饋介面元素缺失！");
        navigateTo('index.html'); return null;
    }

    initialStateArea.style.display = 'none';
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`;
    const outcomeString = state.lastChoiceResult.outcomeText || '影響已產生。';

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

    return outcomeString;
}

/**
 * 填充遊戲結束畫面的內容
 * @param {object} gameState - 包含遊戲結束狀態的物件
 * @returns {string | null} - 返回 endingText 的字串內容，如果無效則返回 null
 */
function populateGameOverScreen(gameState) {
     if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) {
        console.error("populateGameOverScreen 收到無效的 gameState 或遊戲未結束", gameState);
        navigateTo('index.html'); return null;
     }
    const gameOverState = gameState.gameState.gameOver;
    console.log("填充遊戲結束畫面靜態內容...");

    const endingString = gameOverState.endingText || '統治結束。';
    // 檢查 endingText 是否為字串
    if (typeof endingString !== 'string') {
        console.error("Ending text is not a string:", endingString);
        return '統治結束。'; // 返回預設值
    }

    // 設置最終回合數
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--');

    return endingString;
}


// --- 頁面初始化函數 ---

// (initStartScreen, initFeedbackScreen 保持不變)
function initStartScreen() {
    console.log("初始化開始畫面 (v5)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) return;
    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
    console.log("已清除舊的遊戲狀態和歷史。");

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5)");
        startButton.disabled = true;
        try {
            const initialGameState = await callBackend(null);
            saveGameState(initialGameState);
            navigateTo('main-game.html');
        } catch (error) {
            displayError(`無法開始遊戲：${error.message || error}`);
            startButton.disabled = false;
        }
    });
    console.log("開始畫面初始化完畢。");
}
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v5)...");
    const gameState = loadGameState();

    if (!gameState || !gameState.gameState) { navigateTo('index.html'); return; }
    if (gameState.gameState.gameOver?.isOver) { navigateTo('game-over-screen.html'); return; }
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
        console.log("Callback: showFeedbackDetails executing."); // 日誌
        if (resourceChangesAreaElement) {
            console.log("Showing resource changes area."); // 日誌
            resourceChangesAreaElement.style.visibility = 'visible';
            setTimeout(() => {
                resourceChangesAreaElement.style.opacity = '1';
                resourceChangesAreaElement.style.transform = 'translateY(0px)';
            }, 10);
        } else { console.warn("Callback: resourceChangesAreaElement not found."); } // 日誌

        if (continueButtonElement) {
             console.log("Setting timeout for continue button."); // 日誌
             setTimeout(() => {
                 console.log("Showing continue button."); // 日誌
                continueButtonElement.style.visibility = 'visible';
                continueButtonElement.style.opacity = '1';
                continueButtonElement.style.transform = 'translateY(0px)';
                continueButtonElement.disabled = false;
             }, FEEDBACK_REVEAL_DELAY);
        } else { console.warn("Callback: continueButtonElement not found."); } // 日誌
    };

    typewriterEffect(outcomeTextElement, outcomeStringToType, TYPEWRITER_SPEED, showFeedbackDetails);

    continueButtonElement.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v5)");
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        navigateTo('main-game.html');
    });

    console.log("反饋畫面初始化完畢。");
}

/**
 * 初始化遊戲結束畫面 (介面四) - 加入偵錯日誌
 */
function initGameOverScreen() {
    console.log("--- 初始化遊戲結束畫面 (v5) ---"); // 標示開始
    const gameState = loadGameState();

     // 基本的狀態驗證
     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        console.error("結束畫面：找不到有效狀態或遊戲未結束。GameState:", gameState); // 記錄狀態
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }
    console.log("有效的 Game Over 狀態:", JSON.stringify(gameState.gameState.gameOver, null, 2)); // 記錄 gameOver 狀態

    // 獲取元素
    console.log("正在獲取 GameOver 畫面元素...");
    const endingTextElement = document.getElementById('endingText'); // p 元素
    const finalStatsElement = document.querySelector('.final-stats'); // div 元素
    const playAgainButtonElement = document.getElementById('playAgainButton');

    // 確保元素存在
    if (!endingTextElement) console.error("找不到元素: #endingText");
    if (!finalStatsElement) console.error("找不到元素: .final-stats");
    if (!playAgainButtonElement) console.error("找不到元素: #playAgainButton");

    if (!endingTextElement || !finalStatsElement || !playAgainButtonElement) {
        console.error("GameOver 畫面缺少必要的 UI 元素！導航回首頁。");
        navigateTo('index.html');
        return;
    }
    console.log("所有 GameOver 畫面元素已找到。");

    // 1. 先調用 populateGameOverScreen 填充靜態內容 (回合數) 並獲取 endingText
    console.log("正在調用 populateGameOverScreen...");
    const endingStringToType = populateGameOverScreen(gameState);
    console.log("populateGameOverScreen 返回的 endingStringToType:", endingStringToType);

    // 如果 populateGameOverScreen 返回 null (表示狀態無效)，則停止執行
    if (endingStringToType === null) {
        console.error("populateGameOverScreen 返回 null，停止初始化。");
        return;
    }
     // 再次檢查 endingStringToType 是否為字串
     if (typeof endingStringToType !== 'string') {
        console.error("從 populateGameOverScreen 獲取的 ending text 不是字串:", endingStringToType);
        displayError("無法獲取結局描述文字。");
        // 即使文字有問題，也嘗試顯示按鈕讓玩家可以重來
        finalStatsElement.style.visibility = 'visible'; // 直接顯示，不加動畫
        finalStatsElement.style.opacity = '1';
        playAgainButtonElement.style.visibility = 'visible';
        playAgainButtonElement.style.opacity = '1';
        playAgainButtonElement.disabled = false;
        return; // 停止打字機
    }

    // 2. 初始化隱藏統計區和重新開始按鈕
    console.log("正在初始化隱藏統計區和按鈕...");
    finalStatsElement.style.opacity = '0';
    finalStatsElement.style.transform = 'translateY(10px)';
    finalStatsElement.style.visibility = 'hidden';

    playAgainButtonElement.style.opacity = '0';
    playAgainButtonElement.style.transform = 'translateY(10px)';
    playAgainButtonElement.style.visibility = 'hidden';
    playAgainButtonElement.disabled = true;
    console.log("統計區和按鈕已初始化為隱藏。");

    // 3. 定義打字完成後的回調函數
    const showGameOverDetails = () => {
        console.log("Callback: showGameOverDetails executing."); // 日誌
        // 顯示最終統計
        if (finalStatsElement) {
            console.log("Showing final stats area."); // 日誌
            finalStatsElement.style.visibility = 'visible';
            setTimeout(() => {
                finalStatsElement.style.opacity = '1';
                finalStatsElement.style.transform = 'translateY(0px)';
            }, 10);
        } else { console.warn("Callback: finalStatsElement not found."); } // 日誌

        // 顯示重新開始按鈕
        if (playAgainButtonElement) {
             console.log("Setting timeout for play again button."); // 日誌
             setTimeout(() => {
                 console.log("Showing play again button."); // 日誌
                playAgainButtonElement.style.visibility = 'visible';
                playAgainButtonElement.style.opacity = '1';
                playAgainButtonElement.style.transform = 'translateY(0px)';
                playAgainButtonElement.disabled = false;
             }, GAMEOVER_REVEAL_DELAY);
        } else { console.warn("Callback: playAgainButtonElement not found."); } // 日誌
    };

    // 4. 啟動打字機效果
    console.log("正在啟動 typewriterEffect for endingText...");
    typewriterEffect(endingTextElement, endingStringToType, TYPEWRITER_SPEED, showGameOverDetails);

    // 5. 為重新開始按鈕添加事件監聽器
    playAgainButtonElement.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5)");
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
    });

    console.log("--- 遊戲結束畫面初始化完畢 ---"); // 標示結束
}


// (initMainGameScreen 保持不變)
function initMainGameScreen() {
    console.log("初始化主遊戲畫面 (v5)...");
    const gameState = loadGameState();

    if (!gameState || !gameState.gameState || gameState.gameState.gameOver?.isOver) {
        console.log("主遊戲畫面：找不到有效狀態或遊戲已結束，清除狀態並導航回首頁。");
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
        return;
    }

    updateMainUI(gameState); // 更新畫面顯示，觸發打字機

    // 為選項按鈕添加事件監聽器
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
             button.addEventListener('click', async (event) => {
                 if (event.currentTarget.disabled) return;

                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v5)`);

                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true);

                const playerAction = { playerAction: { chosenOptionId: chosenOptionId } };
                const playerActionTurn = { role: 'user', parts: [{ text: JSON.stringify(playerAction) }] };
                let currentHistory = loadHistory();
                const historyToSend = currentHistory.slice(-(MAX_HISTORY_TURNS - 1));

                try {
                    const payload = { playerAction: playerAction, limitedHistory: historyToSend };
                    const newGameState = await callBackend(payload);

                    currentHistory.push(playerActionTurn);
                    if (newGameState && newGameState.gameState) {
                        currentHistory.push({ role: 'model', parts: [{ text: JSON.stringify(newGameState) }] });
                    } else {
                        console.error("【警告】後端未返回有效的 gameState，模型回應未添加到歷史中。");
                    }
                    saveHistory(currentHistory);

                    if (newGameState && newGameState.gameState) {
                        saveGameState(newGameState);
                    } else {
                         console.error("【錯誤】後端未返回有效的 gameState，無法儲存狀態。");
                         displayError("從伺服器獲取的遊戲狀態無效，無法繼續。");
                         document.querySelectorAll('.option-card').forEach(btn => {
                             const optId = btn.id.replace('option','');
                             const optData = gameState.gameState.currentEvent?.options?.find(o => o.id === optId);
                             if(optData && optData.text) btn.disabled = false;
                         });
                         showLoading(false);
                         return;
                    }

                    if (typewriterInterval) {
                        clearInterval(typewriterInterval);
                        typewriterInterval = null;
                    }

                    if (newGameState.gameState.gameOver?.isOver) {
                         console.log("遊戲已結束，導航到結束畫面。");
                         navigateTo('game-over-screen.html');
                    } else {
                         console.log("導航到反饋畫面。");
                         navigateTo('feedback-screen.html');
                    }

                } catch (error) {
                    console.error("處理選項點擊時發生錯誤 (v5):", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || error}`);
                     document.querySelectorAll('.option-card').forEach(btn => {
                         const optId = btn.id.replace('option','');
                         const optData = gameState.gameState.currentEvent?.options?.find(o => o.id === optId);
                         if(optData && optData.text) btn.disabled = false;
                         else btn.disabled = true;
                     });
                    showLoading(false);
                }
            });
        }
    });
    console.log("主遊戲畫面初始化完畢。");
}

