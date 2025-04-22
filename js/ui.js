// js/ui.js
// 負責 UI 更新與視覺效果 (v6.0 - Pre-generated Outcomes)

import { TYPEWRITER_SPEED, OPTION_REVEAL_DELAY, FEEDBACK_REVEAL_DELAY, GAMEOVER_REVEAL_DELAY } from './config.js';
import { navigateTo, displayError } from './main.js'; // 引入導航和錯誤處理

// --- 全局變數 (UI 效果相關) ---
let typewriterInterval = null;

// --- UI 效果函數 ---

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

    disableButtonsDuringTyping(); // 禁用按鈕

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
                     element.innerHTML = marked.parse(originalText); // 使用 innerHTML
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

export function clearTypewriter() {
     if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        console.log("Typewriter interval cleared.");
    }
}

// --- DOM 更新函數 ---

export function setTextContent(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`setTextContent: 找不到 ID 為 "${id}" 的元素。`);
    }
}

export function updateMainUI(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("updateMainUI 收到無效的 gameState", gameState);
        navigateTo('index.html');
        return;
    }
    const state = gameState.gameState;
    console.log("更新主 UI (v6.0)，回合:", state.roundNumber);

    setTextContent('roundNumber', state.roundNumber ?? '--');
    setTextContent('resourcePeople', `🧍 ${state.resources?.people ?? '--'}`);
    setTextContent('resourceArmy', `🛡️ ${state.resources?.army ?? '--'}`);
    setTextContent('resourceTreasury', `💰 ${state.resources?.treasury ?? '--'}`);
    setTextContent('resourceFaith', `✝️ ${state.resources?.faith ?? '--'}`);

    const eventDescElement = document.getElementById('eventDescription');
    const eventStageElement = document.getElementById('eventStage');
    const optionsArea = document.querySelector('.options-area');

    // --- UI 重置和隱藏 ---
    if (optionsArea) optionsArea.style.visibility = 'hidden';
    if (eventStageElement) eventStageElement.style.display = 'none';
    ['A', 'B', 'C'].forEach(optionId => {
        const button = document.getElementById(`option${optionId}`);
        if (button) {
            button.style.opacity = '0';
            button.style.transform = 'translateY(10px)';
            button.disabled = true;
            const textElement = document.getElementById(`option${optionId}Text`);
            if (textElement) textElement.textContent = ''; // 清空舊選項文字
        }
    });
    if (eventDescElement) eventDescElement.textContent = ''; // 清空舊描述
    setTextContent('statusMessage', ''); // 清空狀態消息

    // --- 填充新內容 ---
    if (eventDescElement) {
        // 檢查 currentEvent 是否存在且有效
        const eventData = state.currentEvent;
        if (!eventData || !eventData.description) {
             console.warn("updateMainUI: currentEvent 無效或缺少 description。顯示預設訊息。", eventData);
             // 如果遊戲結束了，不應該在這裡，但作為防禦
             if (state.gameOver?.isOver) {
                  setTextContent('statusMessage', '遊戲已結束。');
             } else {
                  eventDescElement.textContent = '正在等待新的事件...'; // 或其他提示
                  setTextContent('statusMessage', '請稍候...');
             }
             // 禁用所有選項按鈕
             document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
             return; // 提前退出，不執行後續的打字和選項填充
         }

        const descriptionText = eventData.description;
        const afterTypingCallback = () => {
            if (eventStageElement) {
                if (eventData.stage) {
                    eventStageElement.textContent = `(階段 ${eventData.stage})`;
                    eventStageElement.style.display = 'block';
                } else {
                    eventStageElement.style.display = 'none';
                }
            }
            const options = eventData.options || [];
            const optionButtons = ['A', 'B', 'C']
                .map(id => document.getElementById(`option${id}`))
                .filter(btn => btn !== null);
            if (optionsArea) optionsArea.style.visibility = 'visible';
            let delay = 0;
            optionButtons.forEach((button) => {
                const optionId = button.dataset.choice;
                const optionTextElement = document.getElementById(`option${optionId}Text`);
                const optionData = options.find(opt => opt.id === optionId);
                if (optionTextElement && optionData && optionData.text) {
                    optionTextElement.textContent = optionData.text; // 只顯示選項文本
                    setTimeout(() => {
                        button.style.opacity = '1';
                        button.style.transform = 'translateY(0px)';
                        button.disabled = false; // *** 啟用按鈕 ***
                    }, delay);
                    delay += OPTION_REVEAL_DELAY;
                } else if (button) {
                    // 如果找不到對應選項數據或按鈕，保持隱藏和禁用
                    button.style.opacity = '0';
                    button.style.transform = 'translateY(10px)';
                    button.disabled = true;
                    if(optionTextElement) optionTextElement.textContent = ''; // 確保清空
                }
            });
             setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
             // *** 確保按鈕在打字完成且選項填充後才可用 ***
             // (已在 setTimeout 中處理)
        };
        typewriterEffect(eventDescElement, descriptionText, TYPEWRITER_SPEED, afterTypingCallback);
    } else {
        console.warn("找不到 ID 為 'eventDescription' 的元素。");
        setTextContent('statusMessage', state.statusMessage || '請做出您的選擇。');
        // 這裡也應確保選項按鈕被禁用，如果事件描述元素不存在
        document.querySelectorAll('.option-card').forEach(btn => btn.disabled = true);
    }
}


/**
 * 填充反饋畫面的內容 (從 lastChoiceResult 讀取)
 * @param {object} gameState - 包含遊戲狀態和上回合結果的物件
 * @returns {string | null} - 返回 outcomeText 的字串內容，如果無效則返回 null
 */
export function populateFeedbackScreen(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("populateFeedbackScreen 收到無效的 gameState", gameState);
        navigateTo('index.html'); return null;
    }
    const state = gameState.gameState;
    // 驗證 lastChoiceResult 的結構是否完整 (v6.0)
    if (!state.lastChoiceResult || typeof state.lastChoiceResult !== 'object' ||
        !state.lastChoiceResult.chosenOptionId ||
        typeof state.lastChoiceResult.resourceChanges !== 'object' || // 允許空物件 {}
        typeof state.lastChoiceResult.outcomeText !== 'string' || !state.lastChoiceResult.outcomeText) // outcomeText 必須有內容
    {
        console.error("populateFeedbackScreen 的 lastChoiceResult 結構不完整或無效 (v6.0)!", state.lastChoiceResult);
        navigateTo('index.html'); return null; // 或導回 main-game?
    }
    console.log("填充反饋畫面靜態內容 (v6.0)，上回合選擇:", state.lastChoiceResult.chosenOptionId);

    const feedbackTitle = document.getElementById('feedbackTitle');
    const outcomeTextElement = document.getElementById('outcomeText'); // 文本會被 typewriter 填充
    const resourceChangesArea = document.getElementById('resourceChangesArea');
    const resourceChangesList = document.getElementById('resourceChangesList');
    const continueButton = document.getElementById('continueButton');
    const nextRoundNumberSpan = document.getElementById('nextRoundNumber'); // 下一回合數 span

    if (!feedbackTitle || !outcomeTextElement || !resourceChangesArea || !resourceChangesList || !continueButton || !nextRoundNumberSpan) {
        console.error("反饋介面元素缺失！"); navigateTo('index.html'); return null;
    }

    // --- 填充靜態內容 ---
    // roundNumber 應該是觸發這個結果的回合，即當前回合數 - 1
    const resultRound = state.roundNumber - 1;
    feedbackTitle.textContent = `第 ${resultRound} 回合結果`;

    // --- 填充資源變動列表 (從 lastChoiceResult.resourceChanges) ---
    resourceChangesList.innerHTML = '';
    const changes = state.lastChoiceResult.resourceChanges || {}; // 若無則視為空物件
    const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };
    let hasChanges = false;
    for (const key in resourceMap) {
         // 只顯示值不為 0 的變化
         if (Object.hasOwnProperty.call(changes, key) && typeof changes[key] === 'number' && changes[key] !== 0) {
            const changeValue = changes[key];
            const li = document.createElement('li');
            let changeClass = 'change-neutral'; // 雖然不會是 0，保留結構
            if (changeValue > 0) { changeClass = 'change-positive'; hasChanges = true; }
            else if (changeValue < 0) { changeClass = 'change-negative'; hasChanges = true; }
            li.className = changeClass;
            li.textContent = `${resourceMap[key]}: ${changeValue > 0 ? '+' : ''}${changeValue}`; // 顯示正負號
            resourceChangesList.appendChild(li);
        }
     }
     if (!hasChanges && Object.keys(changes).length > 0) { // 如果有 changes 物件但值都是 0
         const li = document.createElement('li');
         li.textContent = "資源無明顯變化。";
         resourceChangesList.appendChild(li);
     } else if (!hasChanges) { // 如果 changes 物件本身就是空的
         const li = document.createElement('li');
         li.textContent = "未記錄資源變化。"; // 或者 "資源無變化。"
         resourceChangesList.appendChild(li);
     }


    // --- 更新繼續按鈕文字 ---
    // state.roundNumber 已經是下一回合的編號了
    nextRoundNumberSpan.textContent = `第 ${state.roundNumber} 回合`;
    continueButton.textContent = `前往 ${nextRoundNumberSpan.textContent}`;

    // --- 返回 outcomeText 供打字機使用 (從 lastChoiceResult.outcomeText) ---
    const outcomeString = state.lastChoiceResult.outcomeText;
    return outcomeString;
}

/**
 * 填充遊戲結束畫面的內容 (從 gameOver 讀取)
 * @param {object} gameState - 包含遊戲結束狀態的物件
 * @returns {string | null} - 返回 endingText 的字串內容，如果無效則返回 null
 */
export function populateGameOverScreen(gameState) {
     if (!gameState || typeof gameState !== 'object' || !gameState.gameState?.gameOver?.isOver) {
        console.error("populateGameOverScreen 收到無效的 gameState 或遊戲未結束", gameState);
        navigateTo('index.html'); return null;
     }
    const gameOverState = gameState.gameState.gameOver;
    const finalResources = gameState.gameState.resources; // 可以顯示最終資源
    console.log("填充遊戲結束畫面靜態內容 (v6.0)...");

    const endingTextElement = document.getElementById('endingText'); // 文本將被 typewriter 填充
    const finalRoundsElement = document.getElementById('finalRounds'); // 回合數 span
    // 可以添加顯示最終資源的元素，例如 <ul id="finalResourceList"></ul>
    const finalResourceListElement = document.getElementById('finalResourceList');

    if (!endingTextElement || !finalRoundsElement) { // 檢查基本元素
         console.warn("GameOver 畫面缺少 endingText 或 finalRounds 元素。");
         // 不直接返回 null，嘗試填充其他部分
    }

    // --- 填充最終回合數 ---
    if (finalRoundsElement) {
         finalRoundsElement.textContent = gameOverState.finalRounds ?? '--';
    }

    // --- 填充最終資源 (可選) ---
    if (finalResourceListElement && finalResources) {
         finalResourceListElement.innerHTML = ''; // 清空舊列表
         const resourceMap = { people: '🧍 人民', army: '🛡️ 軍隊', treasury: '💰 金庫', faith: '✝️ 信仰' };
         for (const key in resourceMap) {
             if (Object.hasOwnProperty.call(finalResources, key)) {
                 const li = document.createElement('li');
                 li.textContent = `${resourceMap[key]}: ${finalResources[key] ?? '未知'}`;
                 finalResourceListElement.appendChild(li);
             }
         }
    } else if (finalResourceListElement) {
         finalResourceListElement.innerHTML = '<li>無法獲取最終資源數據。</li>';
    }

    // --- 返回 endingText 供打字機使用 ---
    const endingString = gameOverState.endingText || '統治結束。';
    if (typeof endingString !== 'string') {
        console.error("Ending text is not a string:", endingString);
        return '統治結束。'; // 提供預設值
    }
    return endingString;
}