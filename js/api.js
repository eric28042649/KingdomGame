// js/api.js
// 負責與後端 Worker API 的通訊

import { WORKER_URL } from './config.js';
import { showLoading } from './ui.js'; // 引入 UI 函數

/**
 * 向後端 Worker 發送請求
 * @param {{ playerAction?: object, currentState?: object, limitedHistory?: Array<object> } | null} payload - 發送給後端的數據
 * @returns {Promise<object>} - 解析後的後端回應 JSON 物件
 * @throws {Error}
 */
export async function callBackend(payload = null) {
    showLoading(true); // 顯示載入提示
    console.log("呼叫後端 (v5.4)，Payload:", payload ? {
        chosenOptionId: payload.playerAction?.chosenOptionId,
        currentStateRound: payload.currentState?.roundNumber,
        historyLength: payload.limitedHistory?.length
     } : null);
    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined,
        };
        const response = await fetch(WORKER_URL, requestOptions); // 發送請求

        // 檢查回應狀態
        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try {
                // 嘗試解析錯誤回應的 JSON 內容
                const errorData = await response.json();
                errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`;
            } catch (e) { /* 解析錯誤回應失敗，忽略 */ }
            throw new Error(errorDetails); // 拋出包含狀態碼和錯誤訊息的 Error
        }

        const backendResponseData = await response.json(); // 解析回應的 JSON

        // 驗證基礎結構
        if (!backendResponseData || typeof backendResponseData !== 'object' || !backendResponseData.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵 (v5.4):", backendResponseData);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }
        console.log("從後端收到回應 (v5.4):", backendResponseData);
        return backendResponseData; // 返回完整的後端回應

    } catch (error) {
        console.error("呼叫後端時發生錯誤 (v5.4):", error);
        // 重新拋出錯誤，以便上層可以捕獲並顯示
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        showLoading(false); // 無論成功或失敗，都隱藏載入提示
    }
}
