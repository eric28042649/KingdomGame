// js/main.js
// 主入口文件，負責初始化、頁面路由和協調其他模組

// 導入設定
import { INITIAL_RESOURCES } from './config.js';

// 導入狀態管理
import { loadGameState, saveGameState, loadHistory, saveHistory } from './state.js';

// 導入 API 通訊
import { callBackend } from './api.js';

// 導入遊戲邏輯
import { applyResourceChanges, checkGameOver, getGenericEndingText } from './game-logic.js';

// 導入 UI 更新與效果
import {
    showLoading,
    typewriterEffect,
    clearTypewriter,
    updateMainUI,
    populateFeedbackScreen,
    populateGameOverScreen
} from './ui.js';

// --- 全局變數 (如果需要，但盡量避免) ---
// typewriterInterval 現在由 ui.js 管理

// --- DOMContentLoaded 事件監聽器 (頁面路由) ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    console.log(`[DOMContentLoaded] Path: ${path || 'index.html'}`);
    switch (path) {
        case '':
        case 'index.html':
        case 'start-screen.html': // 兼容舊名稱
            initStartScreen();
            break;
        case 'main-game.html':
            initMainGameScreen();
            break;
        case 'feedback-screen.html':
            initFeedbackScreen();
            break;
        case 'game-over-screen.html':
            initGameOverScreen();
            break;
        default:
            console.warn("無法識別的頁面路徑:", window.location.pathname);
            navigateTo('index.html'); // 跳轉回首頁
    }
});

// --- 導航與錯誤處理 (放在主文件或 utils.js) ---

/**
 * 導航到指定頁面
 * @param {string} page - 目標頁面的文件名 (e.g., 'index.html')
 */
export function navigateTo(page) {
    console.log(`[Navigate] 準備導航到: ${page}`);
    clearTypewriter(); // 在導航前清除打字機效果
    showLoading(false); // 確保載入提示已隱藏
    window.location.href = page; // 執行頁面跳轉
}

/**
 * 顯示錯誤訊息給使用者 (使用 alert)
 * @param {string} message - 要顯示的錯誤訊息
 */
export function displayError(message) {
    console.error("遊戲錯誤:", message); // 在控制台記錄詳細錯誤
    alert(`發生錯誤：\n${message}`); // 使用 alert 彈窗提示使用者
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一)
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v5.4 Refactored)...");
    const startButton = document.getElementById('startGameButton');
    if (!startButton) { console.error("找不到開始按鈕！"); return; }

    // 清除舊狀態
    sessionStorage.removeItem('kingdomGameState_v5'); // 直接使用 key
    sessionStorage.removeItem('kingdomGameHistory_v5');
    console.log("已清除舊的遊戲狀態和歷史。");

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5.4)");
        startButton.disabled = true;
        try {
            console.log("[StartGame] 正在調用 callBackend(null)...");
            const backendResponse = await callBackend(null); // 使用導入的函數
            console.log("[StartGame] 從後端收到 backendResponse:", JSON.stringify(backendResponse, null, 2));

            if (!backendResponse || !backendResponse.gameState || !backendResponse.gameState.currentEvent) {
                throw new Error("從後端獲取的初始遊戲狀態無效 (缺少 gameState 或 currentEvent)。");
            }
            const stateFromAI = backendResponse.gameState;

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

            // 構建完整的初始 gameState (前端設定)
            const initialGameState = {
                gameState: {
                    roundNumber: 1,
                    resources: { ...INITIAL_RESOURCES }, // 使用導入的常數
                    currentEvent: stateFromAI.currentEvent,
                    lastChoiceResult: null,
                    gameOver: { isOver: false, reason: null, endingText: null, finalRounds: null },
                    statusMessage: stateFromAI.statusMessage || "您的統治開始了..."
                }
            };
            console.log("[StartGame] 構建的完整 initialGameState:", JSON.stringify(initialGameState, null, 2));

            console.log("[StartGame] 正在儲存 gameState...");
            saveGameState(initialGameState); // 使用導入的函數
            console.log("[StartGame] gameState 儲存完畢。");

            try {
                console.log("[StartGame] 正在儲存初始歷史...");
                const initialModelTurn = {
                    role: 'model',
                    parts: [{ text: JSON.stringify(initialGameState) }]
                };
                saveHistory([initialModelTurn]); // 使用導入的函數
                console.log("[StartGame] 初始歷史儲存完畢。");
            } catch (historyError) {
                console.error("儲存初始歷史記錄時出錯:", historyError);
                displayError("無法儲存初始遊戲歷史，可能影響後續遊戲。");
            }

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

/**
 * 初始化主遊戲畫面 (介面二)
 */
function initMainGameScreen() {
    console.log("--- 初始化主遊戲畫面 (v5.4 Refactored) ---");
    const currentFullState = loadGameState(); // 使用導入的函數

    console.log("[MainGame Init] 讀取的 currentFullState:", JSON.stringify(currentFullState, null, 2));
    if (!currentFullState || !currentFullState.gameState) {
        console.error("[MainGame Init] 狀態無效：缺少 gameState。導航回首頁。");
        sessionStorage.removeItem('kingdomGameState_v5'); sessionStorage.removeItem('kingdomGameHistory_v5'); navigateTo('index.html'); return;
    }
    if (!currentFullState.gameState.currentEvent) {
        if (!currentFullState.gameState.gameOver?.isOver) {
            console.error("[MainGame Init] 狀態無效：缺少 currentEvent 且遊戲未結束。導航回首頁。");
            sessionStorage.removeItem('kingdomGameState_v5'); sessionStorage.removeItem('kingdomGameHistory_v5'); navigateTo('index.html'); return;
        }
    }
     if (!currentFullState.gameState.resources) {
        console.error("[MainGame Init] 狀態無效：缺少 resources。導航回首頁。");
        sessionStorage.removeItem('kingdomGameState_v5'); sessionStorage.removeItem('kingdomGameHistory_v5'); navigateTo('index.html'); return;
    }
     if (!currentFullState.gameState.gameOver?.isOver && (!Array.isArray(currentFullState.gameState.currentEvent?.options) || currentFullState.gameState.currentEvent.options.length === 0 || !currentFullState.gameState.currentEvent.options.every(opt => opt && typeof opt.resourceChanges === 'object'))) {
        console.error("[MainGame Init] 狀態無效：currentEvent.options 結構不完整或缺少 resourceChanges。導航回首頁。", currentFullState.gameState.currentEvent?.options);
        sessionStorage.removeItem('kingdomGameState_v5'); sessionStorage.removeItem('kingdomGameHistory_v5'); navigateTo('index.html'); return;
     }

     if (currentFullState.gameState.gameOver?.isOver) {
         console.log("[MainGame Init] 檢測到遊戲已結束狀態，導航到結束畫面。");
         navigateTo('game-over-screen.html');
         return;
     }
     console.log("[MainGame Init] 狀態驗證通過。");

    // 更新 UI (使用導入的函數)
    updateMainUI(currentFullState);

    // 為選項按鈕添加事件監聽器
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
             button.addEventListener('click', async (event) => {
                 if (event.currentTarget.disabled) return;

                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v5.4)`);

                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
                showLoading(true); // 使用導入的函數

                try {
                    console.log("[Option Click] 開始前端計算...");
                    let gameStateForCalc = loadGameState(); // 使用導入的函數
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

                    // 使用導入的遊戲邏輯函數
                    state.resources = applyResourceChanges(state.resources, resourceChanges);

                    const previousRound = state.roundNumber;
                    state.roundNumber = (state.roundNumber || 0) + 1;
                    console.log(`[Option Click] 回合數遞增至 ${state.roundNumber}`);

                    // 使用導入的遊戲邏輯函數
                    const gameOverCheck = checkGameOver(state.resources);
                    state.gameOver = {
                        isOver: gameOverCheck.isOver,
                        reason: gameOverCheck.reason,
                        // 使用導入的遊戲邏輯函數
                        endingText: gameOverCheck.isOver ? getGenericEndingText(gameOverCheck.reason) : null,
                        finalRounds: gameOverCheck.isOver ? previousRound : null
                    };
                    console.log("[Option Click] 遊戲結束檢查結果:", state.gameOver);

                    console.log("[Option Click] 儲存中間狀態...");
                    saveGameState(gameStateForCalc); // 使用導入的函數

                    // 如果遊戲已結束，直接導航
                    if (state.gameOver.isOver) {
                         console.log("[Option Click] 遊戲已結束 (前端計算)，導航到結束畫面。");
                         navigateTo('game-over-screen.html');
                         return;
                    }

                    // --- 調用後端獲取文本 (遊戲未結束時) ---
                    console.log("[Option Click] 準備調用後端獲取 outcomeText 和 next event...");
                    const playerAction = { chosenOptionId: chosenOptionId };
                    const currentStateForBackend = {
                        roundNumber: state.roundNumber,
                        resources: state.resources
                    };
                    let currentHistory = loadHistory(); // 使用導入的函數
                    const historyToSend = currentHistory.slice(-(MAX_HISTORY_TURNS)); // 修正：應該是 MAX_HISTORY_TURNS

                    const payload = { playerAction, currentState: currentStateForBackend, limitedHistory: historyToSend };

                    const backendResponse = await callBackend(payload); // 使用導入的函數
                    console.log("[Option Click] 收到後端回應:", JSON.stringify(backendResponse, null, 2));


                    if (!backendResponse || !backendResponse.gameState) {
                        throw new Error("後端未返回有效的 gameState 結構。");
                    }
                    const aiResponseData = backendResponse.gameState;

                    const outcomeTextFromAI = aiResponseData.lastChoiceResult?.outcomeText;
                    const nextEventFromAI = aiResponseData.currentEvent;

                     if (!nextEventFromAI || !nextEventFromAI.options || !nextEventFromAI.options.every(opt => opt && typeof opt.resourceChanges === 'object')) {
                         console.error("[Option Click] 後端返回的下一事件無效或缺少選項效果:", nextEventFromAI);
                         throw new Error("後端未能提供有效的下一回合事件數據。");
                     }


                    console.log("[Option Click] 準備合併 AI 回應...");
                    let finalGameState = loadGameState(); // 使用導入的函數
                    if (!finalGameState || !finalGameState.gameState) {
                         throw new Error("無法加載中間狀態以合併 AI 回應。");
                    }
                    let finalState = finalGameState.gameState;

                    if (finalState.lastChoiceResult) {
                        finalState.lastChoiceResult.outcomeText = outcomeTextFromAI || "影響已產生。";
                    }
                    finalState.currentEvent = nextEventFromAI;


                    console.log("[Option Click] 儲存最終狀態...");
                    saveGameState(finalGameState); // 使用導入的函數

                    console.log("[Option Click] 更新歷史記錄...");
                    const userTurnForHistory = { role: 'user', parts: [{ text: JSON.stringify(playerAction) }] };
                    const modelTurnForHistory = { role: 'model', parts: [{ text: JSON.stringify(backendResponse) }] };
                    currentHistory.push(userTurnForHistory);
                    currentHistory.push(modelTurnForHistory);
                    saveHistory(currentHistory); // 使用導入的函數

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
                    showLoading(false); // 使用導入的函數
                }
            });
        }
    });
    console.log("--- 主遊戲畫面初始化完畢 ---");
}

/**
 * 初始化反饋畫面 (介面三)
 */
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v5.4 Refactored)...");
    const gameState = loadGameState(); // 使用導入的函數

    if (!gameState || !gameState.gameState) { navigateTo('index.html'); return; }
    // 遊戲結束的判斷已在 main-game 點擊後完成，理論上 feedback 不會載入結束狀態
    // 但為保險起見可以保留
    if (gameState.gameState.gameOver?.isOver) {
        console.warn("[Feedback Init] 檢測到遊戲已結束，重新導向到結束畫面。");
        navigateTo('game-over-screen.html');
        return;
    }
    if (!gameState.gameState.lastChoiceResult) { console.error("反饋畫面缺少 lastChoiceResult!"); navigateTo('index.html'); return; }

    const outcomeTextElement = document.getElementById('outcomeText');
    const resourceChangesAreaElement = document.getElementById('resourceChangesArea');
    const continueButtonElement = document.getElementById('continueButton');

    if (!outcomeTextElement || !resourceChangesAreaElement || !continueButtonElement) {
        console.error("Feedback 畫面缺少必要的 UI 元素！");
        navigateTo('index.html');
        return;
    }

    // 使用導入的 UI 函數填充靜態內容並獲取文本
    const outcomeStringToType = populateFeedbackScreen(gameState);
    if (outcomeStringToType === null) return; // populateFeedbackScreen 內部會處理錯誤導航

    // 初始化隱藏效果
    resourceChangesAreaElement.style.opacity = '0';
    resourceChangesAreaElement.style.transform = 'translateY(10px)';
    resourceChangesAreaElement.style.visibility = 'hidden';
    continueButtonElement.style.opacity = '0';
    continueButtonElement.style.transform = 'translateY(10px)';
    continueButtonElement.style.visibility = 'hidden';
    continueButtonElement.disabled = true;

    // 打字完成後的回調
    const showFeedbackDetails = () => {
        if (resourceChangesAreaElement) {
            resourceChangesAreaElement.style.visibility = 'visible';
            setTimeout(() => {
                resourceChangesAreaElement.style.opacity = '1';
                resourceChangesAreaElement.style.transform = 'translateY(0px)';
            }, 10);
        }
        if (continueButtonElement) {
             setTimeout(() => {
                continueButtonElement.style.visibility = 'visible';
                continueButtonElement.style.opacity = '1';
                continueButtonElement.style.transform = 'translateY(0px)';
                continueButtonElement.disabled = false;
             }, FEEDBACK_REVEAL_DELAY); // 使用導入的常數
        }
    };

    // 啟動打字機效果 (使用導入的函數)
    typewriterEffect(outcomeTextElement, outcomeStringToType, TYPEWRITER_SPEED, showFeedbackDetails); // 使用導入的常數

    // 添加按鈕監聽器
    continueButtonElement.addEventListener('click', () => {
        console.log("繼續按鈕被點擊 (v5.4)");
        navigateTo('main-game.html'); // navigateTo 內部會處理 clearTypewriter
    });

    console.log("反饋畫面初始化完畢。");
}

/**
 * 初始化遊戲結束畫面 (介面四)
 */
function initGameOverScreen() {
    console.log("--- 初始化遊戲結束畫面 (v5.4 Refactored) ---");
    const gameState = loadGameState(); // 使用導入的函數

     if (!gameState || !gameState.gameState || !gameState.gameState.gameOver?.isOver) {
        console.error("結束畫面：找不到有效狀態或遊戲未結束。GameState:", gameState);
        sessionStorage.removeItem('kingdomGameState_v5');
        sessionStorage.removeItem('kingdomGameHistory_v5');
        navigateTo('index.html');
        return;
    }
    console.log("有效的 Game Over 狀態:", JSON.stringify(gameState.gameState.gameOver, null, 2));

    const endingTextElement = document.getElementById('endingText');
    const finalStatsElement = document.querySelector('.final-stats');
    const playAgainButtonElement = document.getElementById('playAgainButton');

    if (!endingTextElement || !finalStatsElement || !playAgainButtonElement) {
        console.error("GameOver 畫面缺少必要的 UI 元素！導航回首頁。");
        navigateTo('index.html');
        return;
    }
    console.log("所有 GameOver 畫面元素已找到。");

    // 使用導入的 UI 函數填充靜態內容並獲取文本
    const endingStringToType = populateGameOverScreen(gameState);
    if (endingStringToType === null) return; // populateGameOverScreen 內部會處理錯誤導航
    if (typeof endingStringToType !== 'string') { // 額外檢查
        console.error("從 populateGameOverScreen 獲取的 ending text 不是字串:", endingStringToType);
        displayError("無法獲取結局描述文字。");
        // 顯示按鈕讓玩家可以重來
        finalStatsElement.style.visibility = 'visible'; finalStatsElement.style.opacity = '1';
        playAgainButtonElement.style.visibility = 'visible'; playAgainButtonElement.style.opacity = '1';
        playAgainButtonElement.disabled = false;
        return;
    }

    // 初始化隱藏效果
    finalStatsElement.style.opacity = '0';
    finalStatsElement.style.transform = 'translateY(10px)';
    finalStatsElement.style.visibility = 'hidden';
    playAgainButtonElement.style.opacity = '0';
    playAgainButtonElement.style.transform = 'translateY(10px)';
    playAgainButtonElement.style.visibility = 'hidden';
    playAgainButtonElement.disabled = true;

    // 打字完成後的回調
    const showGameOverDetails = () => {
        if (finalStatsElement) {
            finalStatsElement.style.visibility = 'visible';
            setTimeout(() => {
                finalStatsElement.style.opacity = '1';
                finalStatsElement.style.transform = 'translateY(0px)';
            }, 10);
        }
        if (playAgainButtonElement) {
             setTimeout(() => {
                playAgainButtonElement.style.visibility = 'visible';
                playAgainButtonElement.style.opacity = '1';
                playAgainButtonElement.style.transform = 'translateY(0px)';
                playAgainButtonElement.disabled = false;
             }, GAMEOVER_REVEAL_DELAY); // 使用導入的常數
        }
    };

    // 啟動打字機效果 (使用導入的函數)
    typewriterEffect(endingTextElement, endingStringToType, TYPEWRITER_SPEED, showGameOverDetails); // 使用導入的常數

    // 添加按鈕監聽器
    playAgainButtonElement.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5.4)");
        sessionStorage.removeItem('kingdomGameState_v5'); // 直接使用 key
        sessionStorage.removeItem('kingdomGameHistory_v5');
        navigateTo('index.html');
    });

    console.log("--- 遊戲結束畫面初始化完畢 ---");
}
