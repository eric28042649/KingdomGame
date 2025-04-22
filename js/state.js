// js/state.js
// 負責遊戲狀態的讀取與儲存 (SessionStorage) (v5.7.6 Debug Load)

import { GAME_STATE_KEY, HISTORY_KEY, NEXT_TURN_EVENT_KEY, MAX_HISTORY_TURNS } from './config.js';
import { displayError } from './main.js';

/**
 * 儲存主遊戲狀態到 sessionStorage
 */
export function saveGameState(gameState) {
    // ... (保持 V5.7.5 版本不變) ...
     if (!gameState?.gameState) {
        console.error("嘗試儲存無效的 gameState:", gameState);
        return;
    }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    } catch (error) {
        console.error("儲存主遊戲狀態失敗:", error);
        displayError("無法儲存遊戲進度。", false);
    }
}

/**
 * 從 sessionStorage 讀取主遊戲狀態
 */
export function loadGameState() {
    // ... (保持 V5.7.5 版本不變) ...
     try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) return null;
        const gameState = JSON.parse(gameStateString);
        if (!gameState?.gameState?.resources || !gameState.gameState.roundNumber || !gameState.gameState.kingdomBackground) {
             console.error("從 SessionStorage 讀取的主 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY);
             return null;
        }
        return gameState;
    } catch (error) {
        console.error("讀取主遊戲狀態失敗:", error);
        displayError("無法讀取遊戲進度。", false);
        sessionStorage.removeItem(GAME_STATE_KEY);
        return null;
    }
}

/**
 * 儲存預載的下一回合事件數據到 sessionStorage
 */
export function saveNextTurnEvent(nextEventData) {
    // ... (保持 V5.7.5 版本不變, 驗證失敗拋出錯誤) ...
     if (!nextEventData || typeof nextEventData !== 'object' || !nextEventData.description || !Array.isArray(nextEventData.options)) {
        const errorMsg = "嘗試儲存無效的 nextTurnEvent 數據 (缺少 description 或 options 陣列)";
        console.error(errorMsg + ":", nextEventData);
        throw new Error(errorMsg);
    }
     if (!nextEventData.options.every(opt => opt.id && opt.text && opt.resourceChanges && opt.outcomeText)) {
         const errorMsg = "嘗試儲存的 nextTurnEvent 選項結構不完整 (缺少 id, text, resourceChanges 或 outcomeText)";
         console.error(errorMsg + ":", nextEventData.options);
         throw new Error(errorMsg);
     }

    try {
        sessionStorage.setItem(NEXT_TURN_EVENT_KEY, JSON.stringify(nextEventData));
        console.log("預載的下一回合事件數據已儲存。");
    } catch (error) {
        console.error("儲存下一回合事件數據失敗:", error);
        throw new Error(`儲存下一回合事件數據時 JSON 序列化失敗: ${error.message}`);
    }
}

/**
 * 從 sessionStorage 讀取預載的下一回合事件數據
 */
export function loadNextTurnEvent() {
    console.log(`[State Load] 嘗試讀取 ${NEXT_TURN_EVENT_KEY}...`); // << 新增日誌
    try {
        const eventDataString = sessionStorage.getItem(NEXT_TURN_EVENT_KEY);
        console.log(`[State Load] 從 sessionStorage 讀取的原始字串:`, eventDataString); // << 新增日誌
        if (!eventDataString) {
            console.log(`[State Load] Key '${NEXT_TURN_EVENT_KEY}' 不存在或為空。`);
            return null;
        }
        const eventData = JSON.parse(eventDataString);
        console.log(`[State Load] 解析後的 eventData:`, eventData); // << 新增日誌

        // 驗證結構
        if (!eventData?.description || !Array.isArray(eventData.options)) {
             console.error("[State Load] 讀取的 nextTurnEvent 數據結構無效 (缺少 description 或 options):", eventData);
             sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
             return null;
        }
        if (!eventData.options.every(opt => opt.id && opt.text && opt.resourceChanges && opt.outcomeText)) {
             console.error("[State Load] 讀取的 nextTurnEvent 選項結構不完整:", eventData.options);
             sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
             return null;
        }
        console.log(`[State Load] 數據驗證通過，返回 eventData。`); // << 新增日誌
        return eventData;
    } catch (error) {
        console.error("[State Load] 讀取或解析下一回合事件數據失敗:", error); // << 修改錯誤訊息
        sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
        return null;
    }
}

/**
 * 清除預載的下一回合事件數據
 */
export function clearNextTurnEvent() {
    // ... (保持 V5.7.5 版本不變) ...
     try {
        sessionStorage.removeItem(NEXT_TURN_EVENT_KEY);
    } catch (error) {
        console.error("清除下一回合事件數據失敗:", error);
    }
}


/**
 * 儲存對話歷史到 sessionStorage
 */
export function saveHistory(history) {
    // ... (保持 V5.7.5 版本不變) ...
     if (!Array.isArray(history)) {
        console.warn("嘗試儲存非陣列的歷史記錄");
        return;
    }
    try {
        const limitedHistory = history.slice(-MAX_HISTORY_TURNS * 2);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
        console.error("儲存對話歷史失敗:", error);
    }
}

/**
 * 從 sessionStorage 讀取對話歷史
 */
export function loadHistory() {
    // ... (保持 V5.7.5 版本不變) ...
     try {
        const historyString = sessionStorage.getItem(HISTORY_KEY);
        if (!historyString) return [];
        const history = JSON.parse(historyString);
        if (!Array.isArray(history)) {
             console.error("從 SessionStorage 讀取的歷史記錄格式非陣列:", history);
             sessionStorage.removeItem(HISTORY_KEY);
             return [];
        }
        return history;
    } catch (error) {
        console.error("讀取對話歷史失敗:", error);
        sessionStorage.removeItem(HISTORY_KEY);
        return [];
    }
}
