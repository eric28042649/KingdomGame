// js/main.js
// 主入口文件，負責初始化、頁面路由和協調其他模組 (v5.7.6 Check Raw Save)

// ... (導入部分保持不變) ...
import {
    INITIAL_RESOURCES, MAX_HISTORY_TURNS, TYPEWRITER_SPEED,
    FEEDBACK_REVEAL_DELAY, GAMEOVER_REVEAL_DELAY, OPTION_REVEAL_DELAY,
    GAME_STATE_KEY, HISTORY_KEY, NEXT_TURN_EVENT_KEY,
    NEXT_TURN_CHECK_INTERVAL, NEXT_TURN_CHECK_TIMEOUT
} from './config.js';
import {
    loadGameState, saveGameState, loadHistory, saveHistory,
    saveNextTurnEvent, loadNextTurnEvent, clearNextTurnEvent
} from './state.js';
import { callBackend } from './api.js';
import { applyResourceChanges, checkGameOver, getGenericEndingText } from './game-logic.js';
import {
    showLoading, updateLoadingText, typewriterEffect, clearTypewriter,
    updateMainUI, populateFeedbackScreen, populateGameOverScreen
} from './ui.js';

let isFetchingNextTurn = false;
let nextTurnCheckTimer = null;
let nextTurnCheckStartTime = 0;

// --- DOMContentLoaded 事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    console.log(`[DOMContentLoaded] Path: ${path || 'index.html'} (v5.7.6)`);
    if (nextTurnCheckTimer) clearTimeout(nextTurnCheckTimer);
    // ... (switch case 保持不變) ...
     switch (path) {
        case '': case 'index.html': case 'start-screen.html':
            initStartScreen(); break;
        case 'main-game.html':
            initMainGameScreen(); break;
        case 'feedback-screen.html':
            initFeedbackScreen(); break;
        case 'game-over-screen.html':
            initGameOverScreen(); break;
        default:
            console.warn("無法識別的頁面路徑:", window.location.pathname);
            navigateTo('index.html');
    }
});

// --- 導航與錯誤處理 ---
export function navigateTo(page) {
    console.log(`[Navigate] 準備導航到: ${page} (v5.7.6)`);
    clearTypewriter();
    showLoading(false);
    if (nextTurnCheckTimer) clearTimeout(nextTurnCheckTimer);
    isFetchingNextTurn = false;
    window.location.href = page;
}

export function displayError(message, navigateToIndex = false) {
    console.error("遊戲錯誤 (v5.7.6):", message);
    showLoading(false);
    isFetchingNextTurn = false;
    if (nextTurnCheckTimer) clearTimeout(nextTurnCheckTimer);
    alert(`發生錯誤：\n${message}`);
    if (navigateToIndex) {
        console.log("錯誤後導航至 index.html");
        navigateTo('index.html');
    }
}

// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面
 */
function initStartScreen() {
    // ... (保持 V5.7.5 版本不變) ...
     console.log("初始化開始畫面 (v5.7.6 Preload)...");
    const startButton = document.getElementById('startGameButton');
    const originalButtonText = startButton ? startButton.textContent : "開啟執政篇章";

    if (!startButton) { console.error("找不到開始按鈕！"); return; }

    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
    console.log("已清除所有遊戲狀態和歷史。");
    startButton.textContent = originalButtonText;
    startButton.disabled = false;

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v5.7.6)");
        startButton.disabled = true;
        updateLoadingText("正在生成王國...");
        showLoading(true);

        let kingdomBackground = null;

        try {
            console.log("[StartGame] 請求背景...");
            const backgroundResponse = await callBackend({ requestType: 'generateBackground' });
            if (!backgroundResponse?.gameState?.kingdomBackground) { throw new Error("從後端獲取的王國背景無效。"); }
            kingdomBackground = backgroundResponse.gameState.kingdomBackground;
            console.log("[StartGame] 成功獲取王國背景。");
            updateLoadingText("正在生成首個事件...");

            console.log("[StartGame] 請求首個完整事件...");
            const firstEventPayload = {
                requestType: 'generateFirstFullEvent',
                kingdomBackground: kingdomBackground,
                currentState: { roundNumber: 1, resources: INITIAL_RESOURCES, kingdomBackground: kingdomBackground },
                limitedHistory: []
            };
            const firstEventResponse = await callBackend(firstEventPayload);
            console.log("[StartGame] 收到首個事件回應:", JSON.stringify(firstEventResponse, null, 2));

            if (!firstEventResponse?.gameState?.currentEvent?.options ||
                !firstEventResponse.gameState.currentEvent.options.every(opt => opt.id && opt.text && opt.resourceChanges && opt.outcomeText)) {
                throw new Error("從後端獲取的初始事件數據結構不完整。");
            }
            const initialEventData = firstEventResponse.gameState;

            const initialGameState = {
                gameState: {
                    roundNumber: 1, resources: { ...INITIAL_RESOURCES }, currentEvent: initialEventData.currentEvent,
                    lastChoiceResult: null, gameOver: { isOver: false, reason: null, endingText: null, finalRounds: null },
                    statusMessage: initialEventData.statusMessage || "您的統治開始了...", kingdomBackground: kingdomBackground
                }
            };
            console.log("[StartGame] 構建的完整 initialGameState:", JSON.stringify(initialGameState, null, 2));

            saveGameState(initialGameState);
            saveHistory([]);
            clearNextTurnEvent();

            console.log("[StartGame] 準備導航到 main-game.html...");
            navigateTo('main-game.html');

        } catch (error) {
            console.error("[StartGame] 處理點擊時發生錯誤:", error);
            displayError(`無法開始遊戲：${error.message || '未知錯誤'}`, false);
            startButton.disabled = false;
            startButton.textContent = originalButtonText;
        }
    });
    console.log("開始畫面初始化完畢。");
}

/**
 * 初始化主遊戲畫面
 */
function initMainGameScreen() {
    // ... (保持 V5.7.5 版本不變) ...
     console.log("--- 初始化主遊戲畫面 (v5.7.6 Preload) ---");
    const currentFullState = loadGameState();

    if (!currentFullState?.gameState?.kingdomBackground) { console.error("[MainGame Init] 狀態無效：缺少 gameState 或 kingdomBackground。"); navigateTo('index.html'); return; }
    if (!currentFullState.gameState.gameOver?.isOver && !currentFullState.gameState.currentEvent) { console.error("[MainGame Init] 狀態無效：遊戲未結束但缺少 currentEvent。"); navigateTo('index.html'); return; }
    if (!currentFullState.gameState.resources) { console.error("[MainGame Init] 狀態無效：缺少 resources。"); navigateTo('index.html'); return; }
    if (currentFullState.gameState.currentEvent && (!Array.isArray(currentFullState.gameState.currentEvent.options) || !currentFullState.gameState.currentEvent.options.every(opt => opt?.id && opt.text && opt.resourceChanges && opt.outcomeText))) {
         console.error("[MainGame Init] 狀態無效：currentEvent.options 結構不完整。", currentFullState.gameState.currentEvent?.options);
         navigateTo('index.html'); return;
     }
    console.log("[MainGame Init] 狀態驗證通過。");

    updateMainUI(currentFullState);

    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        const optionData = currentFullState.gameState.currentEvent?.options?.find(opt => opt.id === optionId);

        if (button && optionData) {
             button.addEventListener('click', async (event) => {
                 if (event.currentTarget.disabled) return;
                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v5.7.6)`);
                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);

                try {
                    console.log("[Option Click] 開始前端計算 (使用預存結果)...");
                    let gameStateContainer = loadGameState();
                    if (!gameStateContainer?.gameState?.currentEvent?.options) { throw new Error("無法加載有效狀態處理點擊。"); }
                    let state = gameStateContainer.gameState;
                    const chosenOption = state.currentEvent.options.find(opt => opt.id === chosenOptionId);
                    if (!chosenOption?.outcomeText || typeof chosenOption.resourceChanges !== 'object') { throw new Error(`選項 ${chosenOptionId} 數據不完整。`); }

                    const preloadedOutcomeText = chosenOption.outcomeText;
                    const resourceChanges = chosenOption.resourceChanges;
                    console.log(`[Option Click] 選項 ${chosenOptionId} resourceChanges:`, resourceChanges);
                    console.log(`[Option Click] 選項 ${chosenOptionId} 預存 outcomeText:`, preloadedOutcomeText);

                    state.resources = applyResourceChanges(state.resources, resourceChanges);
                    const previousRound = state.roundNumber;
                    state.roundNumber = (state.roundNumber || 0) + 1;
                    const gameOverCheck = checkGameOver(state.resources);
                    state.gameOver = { isOver: gameOverCheck.isOver, reason: gameOverCheck.reason, endingText: gameOverCheck.isOver ? getGenericEndingText(gameOverCheck.reason) : null, finalRounds: gameOverCheck.isOver ? previousRound : null };
                    state.lastChoiceResult = { chosenOptionId: chosenOptionId, resourceChanges: resourceChanges, outcomeText: preloadedOutcomeText };

                    console.log("[Option Click] 準備儲存更新後的主狀態...");
                    console.log("[Option Click] Saving state:", JSON.stringify(gameStateContainer, null, 2));
                    saveGameState(gameStateContainer);

                    console.log("[Option Click] 觸發背景請求下一回合數據...");
                    fetchAndStoreNextTurnData(chosenOptionId, state);

                    console.log("[Option Click] 準備導航到 feedback...");
                    navigateTo('feedback-screen.html');

                } catch (error) {
                    console.error("[Option Click] 處理選項點擊時發生嚴重錯誤 (v5.7.6):", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || '未知錯誤'}`, true);
                }
            });
        } else if (button) {
             button.disabled = true;
        }
    });
    console.log("--- 主遊戲畫面初始化完畢 ---");
}

/**
 * 背景函數：請求並儲存下一回合的事件數據
 */
async function fetchAndStoreNextTurnData(chosenOptionId, currentState) {
    if (isFetchingNextTurn) {
        console.log("[Background Fetch] 已经在請求，跳過。");
        return;
    }
    isFetchingNextTurn = true;
    console.log("[Background Fetch] 開始請求下一回合數據...");
    let nextEventDataToSave = null;

    try {
        const playerAction = { chosenOptionId: chosenOptionId };
        const stateForBackend = {
            roundNumber: currentState.roundNumber,
            resources: currentState.resources,
            kingdomBackground: currentState.kingdomBackground
        };
        if (!stateForBackend.kingdomBackground) {
             const freshState = loadGameState();
             stateForBackend.kingdomBackground = freshState?.gameState?.kingdomBackground;
             if (!stateForBackend.kingdomBackground) throw new Error("無法獲取有效的 kingdomBackground。");
        }

        let currentHistory = loadHistory();
        const historyToSend = currentHistory.slice(-MAX_HISTORY_TURNS * 2);

        const payload = {
            requestType: 'processChoiceAndPrepareNext',
            playerAction: playerAction,
            currentState: stateForBackend,
            limitedHistory: historyToSend
        };

        const backendResponse = await callBackend(payload, true);
        console.log("[Background Fetch] 收到後端回應:", backendResponse);

        if (!backendResponse?.nextTurnEvent?.options ||
            !backendResponse.nextTurnEvent.options.every(opt => opt.id && opt.text && opt.resourceChanges && opt.outcomeText)) {
            console.error("[Background Fetch] 後端返回的 nextTurnEvent 數據結構不完整:", backendResponse?.nextTurnEvent);
            throw new Error("後端返回的 nextTurnEvent 數據結構不完整。");
        }

        nextEventDataToSave = backendResponse.nextTurnEvent;
        console.log("**********************************************");
        console.log("[Background Fetch] 準備儲存 nextTurnEvent:", JSON.stringify(nextEventDataToSave, null, 2));
        console.log("**********************************************");

        saveNextTurnEvent(nextEventDataToSave); // 嘗試儲存

        console.log("[Background Fetch] saveNextTurnEvent 調用完成。");

        // --- 新增：檢查儲存後的原始字串 ---
        const rawSavedString = sessionStorage.getItem(NEXT_TURN_EVENT_KEY);
        console.log("##############################################");
        console.log("[Background Fetch] 儲存後 sessionStorage.getItem 返回的原始字串:", rawSavedString);
        console.log("##############################################");
        if (rawSavedString === null || rawSavedString === undefined) {
             console.error("[Background Fetch] 嚴重錯誤：儲存後 sessionStorage.getItem 返回 null 或 undefined！儲存操作可能靜默失敗！");
             // 可以考慮拋出錯誤，以便 catch 區塊能記錄
             throw new Error("sessionStorage.setItem 可能靜默失敗，未能儲存 nextTurnEvent。");
        } else {
             try {
                 // 嘗試解析剛讀取的字串，確保它是有效的 JSON
                 JSON.parse(rawSavedString);
                 console.log("[Background Fetch] 儲存後讀取的原始字串是有效的 JSON。");
             } catch (parseError) {
                 console.error("[Background Fetch] 嚴重錯誤：儲存後讀取的原始字串不是有效的 JSON！", parseError);
                 throw new Error(`儲存的 nextTurnEvent 字串無效: ${parseError.message}`);
             }
        }
        // --- 新增結束 ---


        // 可選：更新當前回合 outcomeText
        if (backendResponse.currentChoiceOutcome?.outcomeText) {
            // ... (邏輯不變) ...
             console.log("[Background Fetch] 收到精確 outcomeText，嘗試更新...");
            let currentGameStateContainer = loadGameState();
            if (currentGameStateContainer?.gameState?.lastChoiceResult?.chosenOptionId === chosenOptionId) {
                currentGameStateContainer.gameState.lastChoiceResult.outcomeText = backendResponse.currentChoiceOutcome.outcomeText;
                saveGameState(currentGameStateContainer);
                console.log("[Background Fetch] 已更新主狀態中的 lastChoiceResult.outcomeText。");
            }
        }
         // 更新歷史記錄
         const modelTurnForHistory = { role: 'model', parts: [{ text: JSON.stringify(backendResponse) }] };
         currentHistory.push({ role: 'user', parts: [{ text: JSON.stringify(playerAction) }] });
         currentHistory.push(modelTurnForHistory);
         saveHistory(currentHistory);

    } catch (error) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("[Background Fetch] 獲取或儲存下一回合數據時發生錯誤:", error); // 保持詳細錯誤輸出
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        clearNextTurnEvent();
    } finally {
        isFetchingNextTurn = false;
        console.log("[Background Fetch] 請求處理完成。");
    }
}


/**
 * 初始化反饋畫面 - 保持調試邏輯
 */
function initFeedbackScreen() {
    // ... (保持 V5.7.5 Debug Jump 版本不變, 驗證失敗時 displayError(msg, false)) ...
     console.log("初始化反饋畫面 (v5.7.6 Debug Jump)...");
    const gameStateContainer = loadGameState();

    if (!gameStateContainer?.gameState) {
        console.error("[Feedback Init] 無法加載有效的 gameState。");
        displayError("無法加載有效的 gameState。", false); return;
    }
    const state = gameStateContainer.gameState;
    if (!state.lastChoiceResult) {
        console.error("[Feedback Init] 狀態無效：缺少 lastChoiceResult!");
        displayError("狀態無效：缺少 lastChoiceResult!", false); return;
    }
     if (typeof state.lastChoiceResult.chosenOptionId !== 'string' ||
         typeof state.lastChoiceResult.outcomeText !== 'string' ||
         typeof state.lastChoiceResult.resourceChanges !== 'object' ||
         state.lastChoiceResult.resourceChanges === null) {
         console.error("[Feedback Init] 狀態無效：lastChoiceResult 結構不完整!", state.lastChoiceResult);
         displayError("狀態無效：lastChoiceResult 結構不完整! " + JSON.stringify(state.lastChoiceResult), false); return;
     }
    console.log("[Feedback Init] 加載的 gameState.lastChoiceResult:", state.lastChoiceResult);

    const outcomeTextElement = document.getElementById('outcomeText');
    const resourceChangesAreaElement = document.getElementById('resourceChangesArea');
    const continueButtonElement = document.getElementById('continueButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingTextElement = loadingIndicator ? loadingIndicator.querySelector('p') : null;

    if (!outcomeTextElement || !resourceChangesAreaElement || !continueButtonElement || !loadingIndicator || !loadingTextElement) {
        console.error("Feedback 畫面缺少必要的 UI 元素！");
        displayError("Feedback 畫面缺少必要的 UI 元素！", true); return;
    }

    const outcomeStringToType = populateFeedbackScreen(gameStateContainer);
    if (outcomeStringToType === null) { return; };

    resourceChangesAreaElement.style.opacity = '0'; resourceChangesAreaElement.style.transform = 'translateY(10px)'; resourceChangesAreaElement.style.visibility = 'hidden';
    continueButtonElement.style.opacity = '0'; continueButtonElement.style.transform = 'translateY(10px)'; continueButtonElement.style.visibility = 'hidden';
    continueButtonElement.disabled = true;
    loadingIndicator.style.display = 'none';

    const showFeedbackDetails = () => {
        if (resourceChangesAreaElement) {
            resourceChangesAreaElement.style.visibility = 'visible';
            setTimeout(() => {
                resourceChangesAreaElement.style.opacity = '1';
                resourceChangesAreaElement.style.transform = 'translateY(0px)';
            }, 10);
        }
        checkAndEnableContinueButton();
    };

    typewriterEffect(outcomeTextElement, outcomeStringToType, TYPEWRITER_SPEED, showFeedbackDetails);

    function checkAndEnableContinueButton() {
        const nextEvent = loadNextTurnEvent();
        console.log("[Feedback Check] loadNextTurnEvent 返回:", nextEvent ? '有效數據' : 'null');

        if (nextEvent) {
            console.log("[Feedback] 下一回合數據已就緒，啟用繼續按鈕。");
             if (continueButtonElement) {
                 continueButtonElement.style.visibility = 'visible';
                 continueButtonElement.style.opacity = '1';
                 continueButtonElement.style.transform = 'translateY(0px)';
                 continueButtonElement.disabled = false;
             }
             if (loadingIndicator) loadingIndicator.style.display = 'none';
             if (nextTurnCheckTimer) { clearTimeout(nextTurnCheckTimer); nextTurnCheckTimer = null; }
        } else if (!isFetchingNextTurn) {
             console.warn("[Feedback] 背景請求已結束，但下一回合數據無效或未成功保存。");
             displayError("無法加載下一回合數據，請查看控制台錯誤日誌或嘗試重新開始遊戲。", false); // 保持不跳轉
             if (continueButtonElement) continueButtonElement.disabled = true;
             if (loadingIndicator) loadingIndicator.style.display = 'none';
             if (nextTurnCheckTimer) { clearTimeout(nextTurnCheckTimer); nextTurnCheckTimer = null; }
        } else {
             console.log("[Feedback] 下一回合數據未就緒，顯示等待提示...");
             if (loadingIndicator && loadingTextElement) {
                 loadingTextElement.textContent = "正在準備下一回合...";
                 loadingIndicator.style.display = 'flex';
             }
             if (!nextTurnCheckTimer) {
                 nextTurnCheckStartTime = Date.now();
                 console.log("[Feedback] 啟動檢查計時器...");
                 nextTurnCheckTimer = setTimeout(checkLoop, NEXT_TURN_CHECK_INTERVAL);
             }
        }
    }

    function checkLoop() {
        console.log("[Feedback CheckLoop] 檢查...");
        const nextEvent = loadNextTurnEvent();
        console.log("[Feedback CheckLoop] loadNextTurnEvent 返回:", nextEvent ? '有效數據' : 'null');

        if (nextEvent) {
            console.log("[Feedback CheckLoop] 數據已找到！");
            checkAndEnableContinueButton();
        } else if (Date.now() - nextTurnCheckStartTime > NEXT_TURN_CHECK_TIMEOUT) {
             console.error("[Feedback CheckLoop] 檢查超時！");
             displayError("加載下一回合數據超時，請檢查網路或重新開始。", false); // 保持不跳轉
             if (loadingIndicator) loadingIndicator.style.display = 'none';
             if (continueButtonElement) continueButtonElement.disabled = true;
             nextTurnCheckTimer = null;
        } else if (!isFetchingNextTurn) {
             console.warn("[Feedback CheckLoop] 背景請求已結束但數據仍無效。");
             checkAndEnableContinueButton(); // 會觸發 displayError (不跳轉)
        } else {
             nextTurnCheckTimer = setTimeout(checkLoop, NEXT_TURN_CHECK_INTERVAL);
        }
    }

    continueButtonElement.addEventListener('click', () => {
        // ... (保持 V5.7.5 Debug Jump 版本不變, 失敗時 displayError(msg, false)) ...
         console.log("繼續按鈕被點擊 (v5.7.6)");
        if (continueButtonElement.disabled) return;
        continueButtonElement.disabled = true;

        const currentStateContainer = loadGameState();
        if (currentStateContainer?.gameState.gameOver?.isOver) {
            console.log("[Feedback] 檢測到遊戲已結束，導航到結束畫面。");
            clearNextTurnEvent();
            navigateTo('game-over-screen.html');
            return;
        }

        const nextEvent = loadNextTurnEvent();
        if (!nextEvent) {
            console.error("[Feedback Continue] 點擊繼續時，下一回合數據無效！");
            displayError("無法加載下一回合數據，請稍後再試。", false); // 保持不跳轉
            continueButtonElement.disabled = false;
            return;
        }

        try {
            console.log("[Feedback Continue] 加載並應用下一回合數據...");
            if (!currentStateContainer) throw new Error("無法加載當前主狀態以應用下一回合數據。");
            let state = currentStateContainer.gameState;

            state.currentEvent = nextEvent;
            state.statusMessage = "請做出您的選擇."; // TODO: statusMessage 來源

            console.log("[Feedback Continue] 儲存包含新事件的主狀態...");
            saveGameState(currentStateContainer);

            clearNextTurnEvent();

            console.log("[Feedback Continue] 導航到主遊戲畫面...");
            navigateTo('main-game.html');

        } catch (error) {
             console.error("[Feedback Continue] 應用下一回合數據時出錯:", error);
             displayError(`處理下一回合數據時發生錯誤: ${error.message}`, true); // 跳轉回 index
        }
    });

    console.log("反饋畫面初始化完畢。");
}


/**
 * 初始化遊戲結束畫面
 */
function initGameOverScreen() {
    // ... (保持 V5.7.5 版本不變) ...
     console.log("--- 初始化遊戲結束畫面 (v5.7.6 Preload) ---");
    clearNextTurnEvent();

    const gameState = loadGameState();

     if (!gameState?.gameState?.gameOver?.isOver) {
        console.error("結束畫面：找不到有效狀態或遊戲未結束。");
        navigateTo('index.html'); return;
    }
    console.log("有效的 Game Over 狀態:", JSON.stringify(gameState.gameState.gameOver, null, 2));

    const endingTextElement = document.getElementById('endingText');
    const finalStatsElement = document.querySelector('.final-stats');
    const playAgainButtonElement = document.getElementById('playAgainButton');

    if (!endingTextElement || !finalStatsElement || !playAgainButtonElement) { console.error("GameOver 畫面缺少必要的 UI 元素！"); navigateTo('index.html'); return; }

    const endingStringToType = populateGameOverScreen(gameState);
    if (endingStringToType === null) return;
    if (typeof endingStringToType !== 'string') {
        console.error("Ending text 不是字串:", endingStringToType);
        displayError("無法獲取結局描述文字。", false);
        finalStatsElement.style.visibility = 'visible'; finalStatsElement.style.opacity = '1';
        playAgainButtonElement.style.visibility = 'visible'; playAgainButtonElement.style.opacity = '1';
        playAgainButtonElement.disabled = false;
        return;
    }

    finalStatsElement.style.opacity = '0'; finalStatsElement.style.transform = 'translateY(10px)'; finalStatsElement.style.visibility = 'hidden';
    playAgainButtonElement.style.opacity = '0'; playAgainButtonElement.style.transform = 'translateY(10px)'; playAgainButtonElement.style.visibility = 'hidden';
    playAgainButtonElement.disabled = true;

    const showGameOverDetails = () => {
        if (finalStatsElement) {
            finalStatsElement.style.visibility = 'visible';
            setTimeout(() => { finalStatsElement.style.opacity = '1'; finalStatsElement.style.transform = 'translateY(0px)'; }, 10);
        }
        if (playAgainButtonElement) {
             setTimeout(() => {
                playAgainButtonElement.style.visibility = 'visible';
                playAgainButtonElement.style.opacity = '1';
                playAgainButtonElement.style.transform = 'translateY(0px)';
                playAgainButtonElement.disabled = false;
             }, GAMEOVER_REVEAL_DELAY);
        }
    };

    typewriterEffect(endingTextElement, endingStringToType, TYPEWRITER_SPEED, showGameOverDetails);

    playAgainButtonElement.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v5.7.6)");
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
        navigateTo('index.html');
    });

    console.log("--- 遊戲結束畫面初始化完畢 ---");
}
