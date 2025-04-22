// js/api.js
// 負責與後端 Worker API 的通訊

import { WORKER_URL } from './config.js';
import { showLoading, updateLoadingText } from './ui.js'; // 引入 UI 函數

/**
 * 向後端 Worker 發送請求
 * @param {object} payload - 發送給後端的數據，應包含 requestType 及其他所需欄位
 * @param {boolean} isBackgroundTask - 標識是否為背景請求 (影響 Loading 顯示)
 * @returns {Promise<object>} - 解析後的後端回應 JSON 物件
 * @throws {Error}
 */
export async function callBackend(payload, isBackgroundTask = false) {
    // 如果不是背景任務，才顯示 Loading
    if (!isBackgroundTask) {
        // showLoading(true); // 在 main.js 中根據需要調用 showLoading 和 updateLoadingText
    }
    console.log(`呼叫後端 (v5.7 Preload)，請求類型: ${payload?.requestType}${isBackgroundTask ? ' (背景)' : ''}`, payload ? {
        hasKingdomBackground: !!payload.kingdomBackground,
        chosenOptionId: payload.playerAction?.chosenOptionId,
        currentStateRound: payload.currentState?.roundNumber,
        historyLength: payload.limitedHistory?.length
     } : null);

    if (!payload || !payload.requestType) {
         console.error("callBackend 缺少 payload 或 requestType");
         if (!isBackgroundTask) showLoading(false); // 確保隱藏 loading
         throw new Error("呼叫後端時缺少必要的請求參數 (requestType)。");
     }

    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        };
        const response = await fetch(WORKER_URL, requestOptions);

        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try { const errorData = await response.json(); errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`; } catch (e) {}
            throw new Error(errorDetails);
        }

        const backendResponseData = await response.json();

        // --- 移除頂層 gameState 驗證，因為回應結構已改變 ---
        // if (!backendResponseData || typeof backendResponseData !== 'object' || !backendResponseData.gameState) {
        //      console.error("後端回應缺少頂層 gameState 鍵 (v5.7):", backendResponseData);
        //      throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        // }

        // --- 在 main.js 中根據 requestType 驗證具體結構 ---
        console.log(`從後端收到回應 (v5.7 Preload - ${payload.requestType}):`, backendResponseData);
        return backendResponseData; // 直接返回解析後的物件

    } catch (error) {
        console.error(`呼叫後端 (${payload.requestType}${isBackgroundTask ? ' 背景' : ''}) 時發生錯誤 (v5.7):`, error);
        // 重新拋出錯誤，讓上層處理 (包括隱藏 Loading)
        throw error; // 直接拋出原始錯誤，包含 message
    } finally {
        // 不在此處隱藏 Loading，由調用者根據情況處理
        // if (!isBackgroundTask) {
        //     showLoading(false);
        // }
    }
}
