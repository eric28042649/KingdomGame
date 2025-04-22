// js/state.js
// 負責遊戲狀態的讀取與儲存 (SessionStorage)

import { GAME_STATE_KEY, HISTORY_KEY, MAX_HISTORY_TURNS } from './config.js';
import { displayError } from './main.js'; // 引入錯誤處理函數

/**
 * 儲存遊戲狀態到 sessionStorage
 * @param {object} gameState - 要儲存的遊戲狀態物件 (包含頂層 gameState)
 */
export function saveGameState(gameState) {
    if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
        console.error("嘗試儲存無效的 gameState:", gameState);
        return;
    }
    try {
        sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("遊戲狀態已儲存。");
    } catch (error) {
        console.error("儲存遊戲狀態失敗:", error);
        displayError("無法儲存遊戲進度。"); // 使用導入的函數
    }
}

/**
 * 從 sessionStorage 讀取遊戲狀態
 * @returns {object | null} - 讀取到的遊戲狀態物件，若無或無效則返回 null
 */
export function loadGameState() {
    try {
        const gameStateString = sessionStorage.getItem(GAME_STATE_KEY);
        if (!gameStateString) {
            // console.log("SessionStorage 中沒有找到遊戲狀態。"); // 正式版可移除
            return null;
        }
        const gameState = JSON.parse(gameStateString);
        if (!gameState || typeof gameState !== 'object' || !gameState.gameState) {
             console.error("從 SessionStorage 讀取的 gameState 結構無效:", gameState);
             sessionStorage.removeItem(GAME_STATE_KEY);
             return null;
        }
        return gameState;
    } catch (error) {
        console.error("讀取遊戲狀態失敗:", error);
        displayError("無法讀取遊戲進度。"); // 使用導入的函數
        sessionStorage.removeItem(GAME_STATE_KEY);
        return null;
    }
}

/**
 * 儲存對話歷史到 sessionStorage (限制長度)
 * @param {Array<object>} history - 完整的對話歷史陣列
 */
export function saveHistory(history) {
    if (!Array.isArray(history)) {
        console.warn("嘗試儲存非陣列的歷史記錄");
        return;
    }
    try {
        const limitedHistory = history.slice(-MAX_HISTORY_TURNS);
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
        console.log(`對話歷史已儲存 (${limitedHistory.length} / ${MAX_HISTORY_TURNS} 條)。`);
    } catch (error) {
        console.error("儲存對話歷史失敗:", error);
        displayError("無法儲存對話歷史。"); // 使用導入的函數
    }
}

/**
 * 從 sessionStorage 讀取對話歷史
 * @returns {Array<object>} - 歷史陣列，若無或無效則返回空陣列
 */
export function loadHistory() {
    try {
        const historyString = sessionStorage.getItem(HISTORY_KEY);
        if (!historyString) {
            // console.log("SessionStorage 中沒有找到對話歷史。"); // 正式版可移除
            return [];
        }
        const history = JSON.parse(historyString);
        if (!Array.isArray(history)) {
             console.error("從 SessionStorage 讀取的歷史記錄格式非陣列:", history);
             sessionStorage.removeItem(HISTORY_KEY);
             return [];
        }
        return history;
    } catch (error) {
        console.error("讀取對話歷史失敗:", error);
        displayError("無法讀取對話歷史。"); // 使用導入的函數
        sessionStorage.removeItem(HISTORY_KEY);
        return [];
    }
}