// js/ui.js
// 負責 UI 更新與視覺效果 (v5.7 Preload)

import { TYPEWRITER_SPEED, OPTION_REVEAL_DELAY, FEEDBACK_REVEAL_DELAY, GAMEOVER_REVEAL_DELAY } from './config.js';
import { navigateTo, displayError } from './main.js'; // 引入導航和錯誤處理

// --- 全局變數 (UI 效果相關) ---
let typewriterInterval = null;

// --- UI 效果函數 ---

/**
 * 顯示/隱藏全局載入提示
 * @param {boolean} show - true 為顯示，false 為隱藏
 */
export function showLoading(show) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        } else if (show) {
            console.warn("找不到 ID 為 'loadingIndicator' 的元素。");
        }
    } catch (e) {
        console.error("控制載入提示時出錯:", e);
    }
}

/**
 * 更新全局載入提示中的文字
 * @param {string} text - 要顯示的文字
 */
export function updateLoadingText(text) {
    try {
        const indicator = document.getElementById('loadingIndicator');
        const textElement = indicator ? indicator.querySelector('p') : null;
        if (textElement) {
            textElement.textContent = text;
        } else {
            console.warn("找不到 loadingIndicator 中的 <p> 元素來更新文字。");
        }
    } catch(e) {
        console.error("更新載入提示文字時出錯:", e);
    }
}


/**
 * 打字機效果函數
 * @param {HTMLElement} element - 要應用效果的 DOM 元素
 * @param {string} text - 要顯示的完整文字
 * @param {number} speed - 打字速度 (毫秒/字)
 * @param {function} callback - 打字完成後執行的回調函數
 */
export function typewriterEffect(element, text, speed, callback) {
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
    }
    if (!element) { console.error("Typewriter effect called with null element."); return; }
    if (typeof text !== 'string') {
        console.warn(`Typewriter effect called with non-string text: ${text}. Using empty string.`);
        text = '';
    }
    element.textContent = ''; // 清空內容
    let i = 0;

    disableButtonsDuringTyping(); // 根據頁面禁用按鈕

    typewriterInterval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
            // Markdown 解析 (如果需要)
            if ((element.id === 'eventDescription' || element.id === 'outcomeText' || element.id === 'endingText') && typeof marked !== 'undefined' && marked.parse) {
                 try {
                     const originalText = element.textContent;
                     element.innerHTML = marked.parse(originalText); // 使用 innerHTML 以渲染 Markdown
                 }
                 catch (e) { console.error("打字機效果後 Markdown 解析錯誤:", e); }
            }
            // 執行回調
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

/**
 * 輔助函數：在打字時禁用頁面上的主要按鈕
 */
function disableButtonsDuringTyping() {
    // 主遊戲畫面
    if (document.body.querySelector('.game-container')) {
         document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
    }
    // 回饋畫面 (打字時禁用繼續按鈕)
    else if (document.body.querySelector('.feedback-container')) {
        const continueBtn = document.getElementById('continueButton');
        if (continueBtn) continueBtn.disabled = true;
    }
    // 遊戲結束畫面
    else if (document.body.querySelector('.game-over-container')) {
        const playAgainBtn = document.getElementById('playAgainButton');
        if (playAgainBtn) playAgainBtn.disabled = true;
    }
    // 開始畫面 (打字時理論上不會觸發，但以防萬一)
     else if (document.body.querySelector('.start-container')) {
         const startBtn = document.getElementById('startGameButton');
         if (startBtn) startBtn.disabled = true;
     }
}

/**
 * 輔助函數：清除打字機計時器 (用於頁面導航前)
 */
export function clearTypewriter() {
     if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        // console.log("Typewriter interval cleared."); // 減少 log
    }
}

// --- DOM 更新函數 ---

/**
 * 輔助函數：設置指定 ID 元素的文本內容
 * @param {string} id - 目標元素的 ID
 * @param {string | number} text - 要設置的文本內容
 */
export function setTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`setTextContent: 找不到 ID 為 "${id}" 的元素。`);
    }
}

/**
 * 更新主遊戲畫面的 UI 元素
 * @param {object} fullGameState - 包含頂層 gameState 的物件
 */
export function updateMainUI(fullGameState) {
    if (!fullGameState?.gameState) {
        console.error("updateMainUI 收到無效的 gameState", fullGameState);
        navigateTo('index.html');
        return;
    }
    const state = fullGameState.gameState;
    console.log("更新主 UI，回合:", state.roundNumber);

    // 更新資源顯示
    setTextContent('roundNumber', state.roundNumber ?? '--');
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);

    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    const optionsArea = document.querySelector('.options-area');
    const statusMessageElement = document.getElementById('statusMessage');

    // 重置選項區域和階段顯示
    if (optionsArea) optionsArea.style.visibility = 'hidden'; // 先隱藏，打字後顯示
    if (eventStageElement) eventStageElement.style.display = 'none';
    if (statusMessageElement) statusMessageElement.textContent = '...'; // 清空狀態信息

    // 重置並禁用所有選項按鈕
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
            button.style.opacity = '0';
            button.style.transform = 'translateY(10px)';
            button.disabled = true;
            const textElement = document.getElementById(`option${optionId}Text`);
            if (textElement) textElement.textContent = ''; // 清空選項文字
        }
    });

    // 如果遊戲結束，不顯示事件描述和選項
    if (state.gameOver?.isOver) {
        if (eventDescElement) eventDescElement.textContent = "您的統治已達終點...";
        if (statusMessageElement) statusMessageElement.textContent = "請前往查看結局。";
        console.log("遊戲已結束，不渲染事件。");
        // 可能需要一個按鈕導航到結束畫面？目前流程是自動導航
        return;
    }

    // 如果 currentEvent 無效 (理論上不應發生，除非狀態損壞)
    if (!state.currentEvent) {
         console.error("updateMainUI: 遊戲未結束但 currentEvent 為空！");
         if (eventDescElement) eventDescElement.textContent = "發生錯誤：缺少當前事件數據。";
         if (statusMessageElement) statusMessageElement.textContent = "請嘗試重新開始遊戲。";
         return;
     }


    // 使用打字機顯示事件描述
    if (eventDescElement) {
        const descriptionText = state.currentEvent.description || '發生了一些事情...'; // 提供預設值
        const afterTypingCallback = () => {
            // 顯示階段 (如果存在)
            if (eventStageElement) {
                if (state.currentEvent.stage) {
                    eventStageElement.textContent = `(階段 ${state.currentEvent.stage})`;
                    eventStageElement.style.display = 'block';
                } else {
                    eventStageElement.style.display = 'none';
                }
            }

            // 逐個顯示選項
            const options = state.currentEvent.options || [];
            if (optionsArea) optionsArea.style.visibility = 'visible';
            let delay = 0;

            ['A', 'B', 'C'].forEach(optionId => {
                const button = document.getElementById(`option${optionId}`);
                const optionData = options.find(opt => opt.id === optionId);
                const optionTextElement = document.getElementById(`option${optionId}Text`);

                if (button && optionData && optionTextElement) {
                    // 找到選項數據，設置文字並延遲顯示
                    optionTextElement.textContent = optionData.text;
                    button.dataset.choice = optionId; // 確保 dataset 正確
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0px)';
                        button.disabled = false; // 啟用按鈕
                    }, delay);
                    delay += OPTION_REVEAL_DELAY;
                } else if (button) {
                    // 如果這個 ID 的選項不存在，保持隱藏和禁用
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(10px)';
                    button.disabled = true;
                    if (optionTextElement) optionTextElement.textContent = ''; // 清空文字
                }
            });

            // 更新狀態信息
             if (statusMessageElement) {
                 statusMessageElement.textContent = state.statusMessage || '請做出您的選擇。';
             }
        };
        typewriterEffect(eventDescElement, descriptionText, TYPEWRITER_SPEED, afterTypingCallback);
    } else {
        console.warn("找不到 ID 為 'eventDescription' 的元素。");
        if (statusMessageElement) statusMessageElement.textContent = state.statusMessage || '請做出您的選擇。';
    }
}


/**
 * 填充反饋畫面的內容 (僅填充靜態部分和返回文本)
 * @param {object} fullGameState - 包含遊戲狀態和上回合結果的物件
 * @returns {string | null} - 返回 outcomeText 的字串內容，如果無效則返回 null
 */
export function populateFeedbackScreen(fullGameState) {
    if (!fullGameState?.gameState?.lastChoiceResult) {
        console.error("populateFeedbackScreen 收到無效的 gameState 或缺少 lastChoiceResult", fullGameState);
        navigateTo('index.html'); return null;
    }
    const state = fullGameState.gameState;
    // 確保 resourceChanges 存在
    const changes = state.lastChoiceResult.resourceChanges || {};
    console.log("填充反饋畫面靜態內容，上回合選擇:", state.lastChoiceResult.chosenOptionId);

    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeTextElement = document.getElementById('outcomeText'); // 用於打字機
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber');

    if (!feedbackTitle || !outcomeTextElement || !resourceChangesArea || !resourceChangesList || !continueButton || !nextRoundNumberSpan) {
        console.error("反饋介面元素缺失！"); navigateTo('index.html'); return null;
    }

    // 設置標題
    feedbackTitle.textContent = `第 ${state.roundNumber - 1} 回合結果`; // 使用計算前的回合數

    // 準備 outcomeText 供打字機使用 (來自 lastChoiceResult)
    const outcomeString = state.lastChoiceResult.outcomeText || '影響已產生。'; // 使用預存或後續更新的文本

    // 填充資源變動列表
    resourceChangesList.innerHTML = ''; // 清空舊列表
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };
    let hasVisibleChanges = false;
    for (const key in resourceMap) {
         if (Object.hasOwnProperty.call(changes, key) && changes[key] !== 0) { // 只顯示實際有變化的
            const changeValue = changes[key];
            const li = document.createElement('li');
            let changeClass = changeValue > 0 ? 'change-positive' : 'change-negative';
            li.className = changeClass;
            li.textContent = `${resourceMap[key]}: ${changeValue > 0 ? '+' : ''}${changeValue}`; // 顯示正負號
            resourceChangesList.appendChild(li);
            hasVisibleChanges = true;
        }
     }
     // 如果沒有任何資源變化，顯示提示
     if (!hasVisibleChanges) {
         const li = document.createElement('li');
         li.className = 'change-neutral';
         li.textContent = "資源無明顯變化。";
         resourceChangesList.appendChild(li);
     }

    // 更新繼續按鈕上的文字 (顯示即將進入的回合)
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;

    return outcomeString; // 返回給打字機效果
}

/**
 * 填充遊戲結束畫面的內容 (僅填充靜態部分和返回文本)
 * @param {object} fullGameState - 包含遊戲結束狀態的物件
 * @returns {string | null} - 返回 endingText 的字串內容，如果無效則返回 null
 */
export function populateGameOverScreen(fullGameState) {
     if (!fullGameState?.gameState?.gameOver?.isOver) {
        console.error("populateGameOverScreen 收到無效的 gameState 或遊戲未結束", fullGameState);
        navigateTo('index.html'); return null;
     }
    const gameOverState = fullGameState.gameState.gameOver;
    console.log("填充遊戲結束畫面靜態內容...");

    const endingString = gameOverState.endingText || '統治結束。';
    if (typeof endingString !== 'string') {
        console.error("Ending text is not a string:", endingString);
        return '統治結束。'; // 提供預設值
    }
    // 填充最終回合數
    setTextContent('finalRounds', gameOverState.finalRounds ?? '--');

    // (可選) 填充其他最終統計數據，如果有的話
    // const finalStatsElement = document.querySelector('.final-stats');
    // if(finalStatsElement) { ... }

    return endingString; // 返回給打字機效果
}
