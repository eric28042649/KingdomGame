// js/main.js
// 主入口文件，負責初始化、頁面路由和協調其他模組 (v6.0 - Pre-generated Outcomes)

// 導入設定
import { INITIAL_RESOURCES, MAX_HISTORY_TURNS, TYPEWRITER_SPEED, FEEDBACK_REVEAL_DELAY, GAMEOVER_REVEAL_DELAY, OPTION_REVEAL_DELAY, GAME_STATE_KEY, HISTORY_KEY } from './config.js';

// 導入狀態管理
import { loadGameState, saveGameState, loadHistory, saveHistory } from './state.js';

// 導入 API 通訊
import { callBackend } from './api.js';

// 導入遊戲邏輯
import { applyResourceChanges, checkGameOver, getGenericEndingText } from './game-logic.js';

// 導入 UI 更新與效果
import {
    showLoading,
    updateLoadingText,
    typewriterEffect,
    clearTypewriter,
    updateMainUI,
    populateFeedbackScreen,
    populateGameOverScreen
} from './ui.js';

// --- DOMContentLoaded 事件監聽器 (頁面路由) ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    console.log(`[DOMContentLoaded V6.0] Path: ${path || 'index.html'}`);
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

// --- 導航與錯誤處理 ---
export function navigateTo(page) {
    console.log(`[Navigate V6.0] 準備導航到: ${page}`);
    clearTypewriter();
    showLoading(false);
    window.location.href = page;
}

export function displayError(message) {
    console.error("遊戲錯誤 V6.0:", message);
    showLoading(false);
    alert(`發生錯誤：\n${message}`);
}


// --- 頁面初始化函數 ---

/**
 * 初始化開始畫面 (介面一) - 修改第二次 API 呼叫
 */
function initStartScreen() {
    console.log("初始化開始畫面 (v6.0)...");
    const startButton = document.getElementById('startGameButton');
    const originalButtonText = startButton ? startButton.textContent : "開啟執政篇章";

    if (!startButton) { console.error("找不到開始按鈕！"); return; }

    sessionStorage.removeItem(GAME_STATE_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
    console.log("已清除舊的遊戲狀態和歷史。");
    startButton.textContent = originalButtonText;
    startButton.disabled = false;

    startButton.addEventListener('click', async () => {
        console.log("開始按鈕被點擊 (v6.0)");
        startButton.disabled = true;
        updateLoadingText("正在生成王國...");
        showLoading(true);

        let kingdomBackground = null;

        try {
            // --- 第一階段：請求生成王國背景 ---
            console.log("[StartGame V6.0] 正在調用 callBackend({ requestType: 'generateBackground' })...");
            const backgroundResponse = await callBackend({ requestType: 'generateBackground' });
            console.log("[StartGame V6.0] 收到背景回應:", backgroundResponse);

            if (!backgroundResponse?.gameState?.kingdomBackground) {
                throw new Error("從後端獲取的王國背景無效。");
            }
            kingdomBackground = backgroundResponse.gameState.kingdomBackground;
            console.log("[StartGame V6.0] 成功獲取王國背景:", kingdomBackground);
            updateLoadingText("正在生成首個事件...");

            // --- 第二階段：請求生成第一個事件 (包含預生成結果) ---
            console.log("[StartGame V6.0] 正在調用 callBackend({ requestType: 'generateFirstEvent', kingdomBackground })...");
            const firstEventResponse = await callBackend({
                requestType: 'generateFirstEvent', // <--- 使用新的請求類型或保持，但期望新格式
                kingdomBackground: kingdomBackground,
                limitedHistory: [] // 初始歷史為空
            });
            console.log("[StartGame V6.0] 收到首個事件回應:", JSON.stringify(firstEventResponse, null, 2));

            // --- 驗證第一個事件 (包含選項內的 outcomeText) ---
            if (!firstEventResponse?.gameState?.currentEvent) {
                throw new Error("從後端獲取的初始遊戲狀態無效 (缺少 gameState 或 currentEvent)。");
            }
            const initialEvent = firstEventResponse.gameState.currentEvent;
             if (!initialEvent.description || !Array.isArray(initialEvent.options) || initialEvent.options.length === 0) {
                  throw new Error("初始事件結構不完整 (缺少 description 或 options)。");
             }
             const optionsValid = initialEvent.options.every((opt, index) => {
                 const isValid = opt && typeof opt.resourceChanges === 'object' && opt.resourceChanges !== null && typeof opt.outcomeText === 'string' && opt.outcomeText;
                 if (!isValid) console.error(`[StartGame V6.0 Validation] 選項 ${index} (ID: ${opt?.id}) 結構無效或缺少 resourceChanges/outcomeText。`, opt);
                 return isValid;
             });
             if (!optionsValid) {
                  throw new Error("初始事件的部分選項缺少 resourceChanges 或 outcomeText 數據。");
             }
            console.log("[StartGame V6.0] 後端返回的 initial currentEvent 驗證通過。");

            // --- 構建完整的初始 gameState ---
            const initialGameState = {
                gameState: {
                    roundNumber: 1,
                    resources: { ...INITIAL_RESOURCES },
                    currentEvent: initialEvent, // <--- 直接使用後端返回的帶結果的事件
                    lastChoiceResult: null, // 初始為 null
                    gameOver: { isOver: false, reason: null, endingText: null, finalRounds: null },
                    statusMessage: firstEventResponse.gameState.statusMessage || "您的統治開始了...", // 使用後端返回的 statusMessage 或預設值
                    kingdomBackground: kingdomBackground // 儲存王國背景
                }
            };
            console.log("[StartGame V6.0] 構建的完整 initialGameState:", JSON.stringify(initialGameState, null, 2));

            saveGameState(initialGameState);
            saveHistory([]); // 初始歷史為空
            console.log("[StartGame V6.0] 準備導航到 main-game.html...");
            navigateTo('main-game.html');

        } catch (error) {
            console.error("[StartGame V6.0] 處理點擊時發生錯誤:", error);
            displayError(`無法開始遊戲：${error.message || '未知錯誤'}`);
            startButton.disabled = false;
            startButton.textContent = originalButtonText;
            showLoading(false); // 確保錯誤時隱藏 loading
        }
        // finally { showLoading(false); } // 已在錯誤處理和成功導航中處理
    });
    console.log("開始畫面初始化完畢 (v6.0)。");
}


/**
 * 初始化主遊戲畫面 (介面二) - 修改選項點擊邏輯
 */
function initMainGameScreen() {
    console.log("--- 初始化主遊戲畫面 (v6.0 - Pre-gen Outcomes) ---");
    const currentFullState = loadGameState();

    console.log("[MainGame Init V6.0] 讀取的 currentFullState:", JSON.stringify(currentFullState, null, 2));

    // --- 狀態驗證 (加入 outcomeText 檢查) ---
    if (!currentFullState?.gameState) { console.error("[MainGame Init V6.0] 狀態無效：缺少 gameState。導航回首頁。"); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
    const state = currentFullState.gameState;
    if (!state.kingdomBackground) { console.error("[MainGame Init V6.0] 狀態無效：缺少 kingdomBackground。導航回首頁。"); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
    if (!state.resources) { console.error("[MainGame Init V6.0] 狀態無效：缺少 resources。導航回首頁。"); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
    // 如果遊戲未結束，currentEvent 必須有效且包含帶 outcomeText 的選項
    if (!state.gameOver?.isOver) {
        if (!state.currentEvent) { console.error("[MainGame Init V6.0] 狀態無效：遊戲未結束但缺少 currentEvent。導航回首頁。"); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
        if (!Array.isArray(state.currentEvent.options) || state.currentEvent.options.length === 0) { console.error("[MainGame Init V6.0] 狀態無效：currentEvent.options 無效。導航回首頁。"); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
        if (!state.currentEvent.options.every(opt => opt && typeof opt.resourceChanges === 'object' && typeof opt.outcomeText === 'string' && opt.outcomeText)) { console.error("[MainGame Init V6.0] 狀態無效：currentEvent.options 結構不完整或缺少 resourceChanges/outcomeText。導航回首頁。", state.currentEvent.options); sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return; }
    }
    console.log("[MainGame Init V6.0] 狀態驗證通過。");

    // 更新 UI
    updateMainUI(currentFullState);

    // --- 為選項按鈕添加事件監聽器 (核心修改) ---
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        // 確保按鈕存在且 currentEvent 存在才綁定
        if (button && state.currentEvent) {
             button.addEventListener('click', async (event) => { // 改為 async 以防未來需要 await
                 if (event.currentTarget.disabled) return; // 防止重複點擊

                const chosenOptionId = event.currentTarget.dataset.choice;
                console.log(`選項 ${chosenOptionId} 被點擊 (v6.0)`);

                document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true); // 禁用所有選項
                // 不再需要 showLoading(true) 因為結果是即時的

                try {
                    // --- 前端處理 ---
                    console.log("[Option Click V6.0] 開始前端處理...");
                    let gameStateForProcessing = loadGameState(); // 獲取最新狀態
                    if (!gameStateForProcessing?.gameState?.currentEvent?.options) { throw new Error("無法加載有效的遊戲狀態或事件選項來處理點擊。"); }
                    let currentState = gameStateForProcessing.gameState;
                    console.log("[Option Click V6.0] 處理前 state:", JSON.stringify(currentState, null, 2));

                    // --- 查找被選中的選項數據 (包含預生成的結果) ---
                    const chosenOption = currentState.currentEvent.options.find(opt => opt.id === chosenOptionId);
                    if (!chosenOption || typeof chosenOption.resourceChanges !== 'object' || typeof chosenOption.outcomeText !== 'string') {
                        throw new Error(`找不到選項 ${chosenOptionId} 的有效數據 (resourceChanges 或 outcomeText)。`);
                    }
                    const resourceChanges = chosenOption.resourceChanges;
                    const outcomeText = chosenOption.outcomeText; // <--- 直接獲取預生成的結果文本

                    console.log(`[Option Click V6.0] 選項 ${chosenOptionId} 的 resourceChanges:`, resourceChanges);
                    console.log(`[Option Click V6.0] 選項 ${chosenOptionId} 的 outcomeText:`, outcomeText);

                    // --- 更新狀態 ---
                    // 1. 記錄結果到 lastChoiceResult 以便 feedback 畫面使用
                    currentState.lastChoiceResult = {
                        chosenOptionId: chosenOptionId,
                        resourceChanges: resourceChanges, // 實際應用的變化
                        outcomeText: outcomeText         // 預生成的文本
                    };
                    // 2. 計算新資源
                    currentState.resources = applyResourceChanges(currentState.resources, resourceChanges);
                    // 3. 遞增回合數
                    const previousRound = currentState.roundNumber;
                    currentState.roundNumber = (currentState.roundNumber || 0) + 1;
                    // 4. 檢查遊戲是否結束
                    const gameOverCheck = checkGameOver(currentState.resources);
                    currentState.gameOver = {
                        isOver: gameOverCheck.isOver,
                        reason: gameOverCheck.reason,
                        // 結局文本由後端決定，但這裡可以用通用的
                        endingText: gameOverCheck.isOver ? getGenericEndingText(gameOverCheck.reason) : null,
                        finalRounds: gameOverCheck.isOver ? previousRound : null
                    };
                    // 5. 清除當前事件，因為已經處理完畢，等待 feedback 畫面結束後加載新事件
                    // currentState.currentEvent = null; // 暫不清空，feedback 可能需要參考

                    console.log("[Option Click V6.0] 處理後 state:", JSON.stringify(currentState, null, 2));
                    console.log("[Option Click V6.0] 儲存狀態...");
                    saveGameState(gameStateForProcessing); // 儲存包含 lastChoiceResult 的狀態

                    // --- 更新歷史記錄 ---
                    console.log("[Option Click V6.0] 更新歷史記錄...");
                    let currentHistory = loadHistory();
                    // 記錄玩家的選擇和預生成的結果
                    const userActionText = `玩家選擇了選項 ${chosenOptionId}。`;
                    const outcomeForHistory = `結果：${outcomeText} (資源變化: ${JSON.stringify(resourceChanges)})`;
                    currentHistory.push({ role: 'user', parts: [{ text: userActionText }] });
                    currentHistory.push({ role: 'model', parts: [{ text: outcomeForHistory }] }); // 將前端處理的結果放入歷史
                    saveHistory(currentHistory);


                    // --- 導航到反饋畫面 ---
                    console.log("[Option Click V6.0] 準備導航到 feedback...");
                    navigateTo('feedback-screen.html');

                } catch (error) {
                    console.error("[Option Click V6.0] 處理選項點擊時發生嚴重錯誤:", error);
                    displayError(`處理您的選擇時發生錯誤：${error.message || '未知錯誤'}`);
                    // 恢復按鈕狀態 (可能需要重新讀取狀態)
                    document.querySelectorAll('.option-card').forEach(btn => {
                         const latestState = loadGameState();
                         const optId = btn.dataset.choice;
                         if (latestState?.gameState?.currentEvent?.options?.some(o => o.id === optId) && !latestState?.gameState?.gameOver?.isOver) {
                             btn.disabled = false;
                         } else {
                             btn.disabled = true;
                         }
                     });
                    // showLoading(false); // displayError 已處理
                }
            });
        } else if (button) {
             // 如果按鈕存在但 currentEvent 為空或遊戲結束，確保禁用
             button.disabled = true;
        }
    });
    console.log("--- 主遊戲畫面初始化完畢 (v6.0) ---");
}

/**
 * 初始化反饋畫面 (介面三) - 修改繼續按鈕邏輯
 */
function initFeedbackScreen() {
    console.log("初始化反饋畫面 (v6.0 - Pre-gen Outcomes)...");
    const currentFullState = loadGameState();

    if (!currentFullState?.gameState) { navigateTo('index.html'); return; }
    const state = currentFullState.gameState;

    // 驗證 lastChoiceResult 是否存在且包含必要信息
    if (!state.lastChoiceResult || typeof state.lastChoiceResult !== 'object' || !state.lastChoiceResult.chosenOptionId || typeof state.lastChoiceResult.resourceChanges !== 'object' || typeof state.lastChoiceResult.outcomeText !== 'string') {
        console.error("反饋畫面缺少有效 lastChoiceResult (v6.0)!", state.lastChoiceResult);
        navigateTo('index.html'); // 或導航回 main-game?
        return;
    }

    const outcomeTextElement = document.getElementById('outcomeText');
    const resourceChangesAreaElement = document.getElementById('resourceChangesArea');
    const continueButtonElement = document.getElementById('continueButton');

    if (!outcomeTextElement || !resourceChangesAreaElement || !continueButtonElement) {
        console.error("Feedback 畫面缺少必要的 UI 元素！"); navigateTo('index.html'); return;
    }

    // --- 使用 UI 函數填充內容 ---
    const outcomeStringToType = populateFeedbackScreen(currentFullState); // populateFeedbackScreen 現在會從 lastChoiceResult 取 outcomeText
    if (outcomeStringToType === null) return; // populateFeedbackScreen 內部會處理錯誤導航

    // 初始化隱藏效果
    resourceChangesAreaElement.style.opacity = '0'; resourceChangesAreaElement.style.transform = 'translateY(10px)'; resourceChangesAreaElement.style.visibility = 'hidden';
    continueButtonElement.style.opacity = '0'; continueButtonElement.style.transform = 'translateY(10px)'; continueButtonElement.style.visibility = 'hidden';
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
                continueButtonElement.disabled = false; // 啟用按鈕
             }, FEEDBACK_REVEAL_DELAY);
        }
    };

    // 啟動打字機效果
    typewriterEffect(outcomeTextElement, outcomeStringToType, TYPEWRITER_SPEED, showFeedbackDetails);

    // --- 為繼續按鈕添加點擊事件監聽器 (核心修改) ---
    continueButtonElement.addEventListener('click', async () => { // 改為 async
        if (continueButtonElement.disabled) return; // 防止重複點擊

        console.log("繼續按鈕被點擊 (v6.0)");
        clearTypewriter();
        continueButtonElement.disabled = true; // 禁用按鈕

        const currentStateBeforeBackendCall = loadGameState(); // 獲取最新狀態
        if (!currentStateBeforeBackendCall?.gameState) {
            displayError("無法加載當前狀態以繼續遊戲。");
            navigateTo('index.html');
            return;
        }
        const finalState = currentStateBeforeBackendCall.gameState;

        // --- 檢查遊戲是否結束 ---
        if (finalState.gameOver?.isOver) {
            console.log("[Feedback V6.0] 檢測到遊戲已結束，導航到結束畫面。");
            navigateTo('game-over-screen.html');
        } else {
            // --- 遊戲未結束，呼叫後端獲取下一回合事件 ---
            console.log("[Feedback V6.0] 遊戲未結束，準備呼叫後端獲取下一回合事件...");
            updateLoadingText("正在生成下回合事件..."); // <<<< 更新載入文字
            showLoading(true); // <<<< 顯示載入畫面

            try {
                const lastPlayerAction = { chosenOptionId: finalState.lastChoiceResult.chosenOptionId };
                const currentStateForBackend = {
                    roundNumber: finalState.roundNumber, // 這是下一回合的編號
                    resources: finalState.resources,   // 這是計算後的資源
                    // kingdomBackground is needed by worker
                };
                let currentHistory = loadHistory();
                const historyToSend = currentHistory.slice(-MAX_HISTORY_TURNS);

                const payload = {
                    requestType: 'generateNextEvent', // <--- 新的請求類型
                    lastPlayerAction: lastPlayerAction,
                    currentState: currentStateForBackend,
                    kingdomBackground: finalState.kingdomBackground, // <--- 必須傳遞背景
                    limitedHistory: historyToSend
                };

                const backendResponse = await callBackend(payload); // callBackend 內部會 showLoading(true)
                console.log("[Feedback V6.0] 收到下一事件回應:", JSON.stringify(backendResponse, null, 2));

                // --- 驗證後端回應 (下一事件) ---
                if (!backendResponse?.gameState?.currentEvent) {
                    throw new Error("後端未返回有效的下一事件數據 (缺少 gameState 或 currentEvent)。");
                }
                const nextEvent = backendResponse.gameState.currentEvent;
                if (!nextEvent.description || !Array.isArray(nextEvent.options) || nextEvent.options.length === 0 ||
                    !nextEvent.options.every(opt => opt && typeof opt.resourceChanges === 'object' && typeof opt.outcomeText === 'string')) {
                     throw new Error("後端返回的下一事件結構無效或缺少必要數據 (description, options, resourceChanges, outcomeText)。");
                 }
                 console.log("[Feedback V6.0] 後端返回的 nextEvent 驗證通過。");

                // --- 更新遊戲狀態 ---
                finalState.currentEvent = nextEvent; // <--- 存儲下一回合的事件
                 // 可選：更新 statusMessage
                 if (backendResponse.gameState.statusMessage) {
                     finalState.statusMessage = backendResponse.gameState.statusMessage;
                 } else {
                     finalState.statusMessage = "新的挑戰出現了..."; // 預設提示
                 }
                // 清除上回合結果，因為已經進入新回合
                // finalState.lastChoiceResult = null; // 暫不清空，若 history 需要參考

                console.log("[Feedback V6.0] 儲存包含下一事件的狀態...");
                saveGameState(currentStateBeforeBackendCall); // 儲存更新後的完整狀態

                // --- 更新歷史記錄 (AI 回應) ---
                // 可以在這裡記錄 AI 生成的下一事件，但可能使歷史過於冗長
                 console.log("[Feedback V6.0] 歷史記錄已在選項點擊時更新，此處不重複記錄 AI 回應。");

                // --- 導航到主遊戲畫面 ---
                console.log("[Feedback V6.0] 準備導航到 main-game.html...");
                navigateTo('main-game.html'); // navigateTo 會隱藏 loading

            } catch (error) {
                console.error("[Feedback V6.0] 獲取下一事件時發生錯誤:", error);
                displayError(`無法獲取下一回合的事件：${error.message || '未知錯誤'}`);
                continueButtonElement.disabled = false; // 重新啟用按鈕
                showLoading(false); // 確保錯誤時隱藏 loading
            }
            // finally { showLoading(false); } // 成功導航會隱藏，錯誤處理會隱藏
        }
    });

    console.log("反饋畫面初始化完畢 (v6.0)。");
}


/**
 * 初始化遊戲結束畫面 (介面四) - 無需大改
 */
function initGameOverScreen() {
    console.log("--- 初始化遊戲結束畫面 (v6.0) ---");
    const gameState = loadGameState();

     if (!gameState?.gameState?.gameOver?.isOver) {
        console.error("結束畫面：找不到有效狀態或遊戲未結束。GameState:", gameState);
        sessionStorage.removeItem(GAME_STATE_KEY); sessionStorage.removeItem(HISTORY_KEY); navigateTo('index.html'); return;
    }
    console.log("有效的 Game Over 狀態:", JSON.stringify(gameState.gameState.gameOver, null, 2));

    const endingTextElement = document.getElementById('endingText');
    const finalStatsElement = document.querySelector('.final-stats');
    const playAgainButtonElement = document.getElementById('playAgainButton');

    if (!endingTextElement || !finalStatsElement || !playAgainButtonElement) { console.error("GameOver 畫面缺少必要的 UI 元素！導航回首頁。"); navigateTo('index.html'); return; }
    console.log("所有 GameOver 畫面元素已找到。");

    // --- 使用 UI 函數填充內容 ---
    // 確保 endingText 是後端生成的或 fallback
    let endingTextFromState = gameState.gameState.gameOver.endingText;
    if (!endingTextFromState && gameState.gameState.gameOver.reason) {
        console.warn("Game Over state missing endingText, generating generic one.");
        endingTextFromState = getGenericEndingText(gameState.gameState.gameOver.reason);
    } else if (!endingTextFromState) {
        endingTextFromState = "您的統治走到了終點...";
    }
    gameState.gameState.gameOver.endingText = endingTextFromState; // 確保 state 中有文本

    const endingStringToType = populateGameOverScreen(gameState); // 內部會從 gameState.gameOver.endingText 讀取
    if (endingStringToType === null) return;

    if (typeof endingStringToType !== 'string') {
        console.error("從 populateGameOverScreen 獲取的 ending text 不是字串:", endingStringToType);
        displayError("無法獲取結局描述文字。");
        finalStatsElement.style.visibility = 'visible'; finalStatsElement.style.opacity = '1';
        playAgainButtonElement.style.visibility = 'visible'; playAgainButtonElement.style.opacity = '1';
        playAgainButtonElement.disabled = false;
        return;
    }

    // 初始化隱藏效果
    finalStatsElement.style.opacity = '0'; finalStatsElement.style.transform = 'translateY(10px)'; finalStatsElement.style.visibility = 'hidden';
    playAgainButtonElement.style.opacity = '0'; playAgainButtonElement.style.transform = 'translateY(10px)'; playAgainButtonElement.style.visibility = 'hidden';
    playAgainButtonElement.disabled = true;

    // 打字完成後的回調
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

    // 啟動打字機效果
    typewriterEffect(endingTextElement, endingStringToType, TYPEWRITER_SPEED, showGameOverDetails);

    // 添加按鈕監聽器
    playAgainButtonElement.addEventListener('click', () => {
        console.log("重新開始按鈕被點擊 (v6.0)");
        sessionStorage.removeItem(GAME_STATE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
        navigateTo('index.html');
    });

    console.log("--- 遊戲結束畫面初始化完畢 (v6.0) ---");
}