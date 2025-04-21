// js/ui.js
// 負責 UI 更新與視覺效果

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
    element.textContent = ''; // 清空內容，避免 Markdown 解析問題
    let i = 0;

    // 根據頁面禁用按鈕
    disableButtonsDuringTyping();

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
                     element.innerHTML = marked.parse(originalText);
                 }
                 catch (e) { console.error("打字機效果後 Markdown 解析錯誤:", e); }
            }
            // 執行回調
            if (callback) {
                try { callback(); }
                catch(callbackError) {
                    console.error(`Error executing typewriter callback for #${element.id}:`, callbackError);
                    displayError(`顯示後續內容時發生錯誤: ${callbackError.message}`); // 使用導入的函數
                }
            }
        }
    }, speed);
}

/**
 * 輔助函數：在打字時禁用頁面上的主要按鈕
 */
function disableButtonsDuringTyping() {
    if (document.body.querySelector('.game-container')) {
         document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
    } else if (document.body.querySelector('.feedback-container')) {
        const continueBtn = document.getElementById('continueButton');
        if (continueBtn) continueBtn.disabled = true;
    } else if (document.body.querySelector('.game-over-container')) {
        const playAgainBtn = document.getElementById('playAgainButton');
        if (playAgainBtn) playAgainBtn.disabled = true;
    }
}

/**
 * 輔助函數：清除打字機計時器 (用於頁面導航前)
 */
export function clearTypewriter() {
     if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        console.log("Typewriter interval cleared.");
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
 * @param {object} gameState - 包含當前遊戲狀態的物件
 */
export function updateMainUI(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("updateMainUI 收到無效的 gameState", gameState);
        navigateTo('index.html'); // 使用導入的函數
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

/**
 * 填充反饋畫面的內容 (僅填充靜態部分和返回文本)
 * @param {object} gameState - 包含遊戲狀態和上回合結果的物件
 * @returns {string | null} - 返回 outcomeText 的字串內容，如果無效則返回 null
 */
export function populateFeedbackScreen(gameState) {
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
    console.log("填充反饋畫面靜態內容，上回合選擇:", state.lastChoiceResult.chosenOptionId);

    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeTextElement = document.getElementById('outcomeText'); // 需要檢查是否存在
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

    // 填充資源變動列表
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

    // 更新按鈕文字
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;

    return outcomeString; // 返回文本供打字機使用
}

/**
 * 填充遊戲結束畫面的內容 (僅填充靜態部分和返回文本)
 * @param {object} gameState - 包含遊戲結束狀態的物件
 * @returns {string | null} - 返回 endingText 的字串內容，如果無效則返回 null
 */
export function populateGameOverScreen(gameState) {
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
