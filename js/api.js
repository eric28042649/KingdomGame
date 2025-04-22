// js/api.js
// 負責與後端 Worker API 的通訊

import { WORKER_URL } from './config.js';
import { showLoading } from './ui.js'; // 引入 UI 函數

/**
 * 向後端 Worker 發送請求
 * @param {object} payload - 發送給後端的數據，應包含 requestType 及其他所需欄位
 * @returns {Promise<object>} - 解析後的後端回應 JSON 物件
 * @throws {Error}
 */
export async function callBackend(payload) { // 移除 payload = null 預設值，確保 payload 總是被提供
    showLoading(true); // 顯示載入提示
    // 更新 Log 訊息以包含 requestType 和更多細節
    console.log(`呼叫後端 (v5.5)，請求類型: ${payload?.requestType}`, payload ? {
        hasKingdomBackground: !!payload.kingdomBackground,
        chosenOptionId: payload.playerAction?.chosenOptionId,
        currentStateRound: payload.currentState?.roundNumber,
        historyLength: payload.limitedHistory?.length
     } : null);

    if (!payload || !payload.requestType) { // 基本驗證
         console.error("callBackend 缺少 payload 或 requestType");
         showLoading(false);
         throw new Error("呼叫後端時缺少必要的請求參數 (requestType)。");
     }

    try {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), // 直接序列化 payload
        };
        const response = await fetch(WORKER_URL, requestOptions);

        // 檢查回應狀態
        if (!response.ok) {
            let errorDetails = `伺服器回應錯誤: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorDetails += ` - ${errorData.error || JSON.stringify(errorData.details || errorData)}`;
            } catch (e) { /* 解析錯誤回應失敗，忽略 */ }
            throw new Error(errorDetails);
        }

        const backendResponseData = await response.json();

        // 基礎結構驗證 (保持不變，所有回應都應有 gameState)
        if (!backendResponseData || typeof backendResponseData !== 'object' || !backendResponseData.gameState) {
             console.error("後端回應缺少頂層 gameState 鍵 (v5.5):", backendResponseData);
             throw new Error('從後端收到的回應格式不正確 (缺少 gameState)。');
        }

        // 針對特定請求的回應驗證 (可在 main.js 中進行，或在此處添加)
        // 例如: if (payload.requestType === 'generateBackground' && !backendResponseData.gameState.kingdomBackground) ...

        console.log("從後端收到回應 (v5.5):", backendResponseData);
        return backendResponseData;

    } catch (error) {
        console.error(`呼叫後端 (${payload.requestType}) 時發生錯誤 (v5.5):`, error);
        // 重新拋出錯誤，以便上層可以捕獲並顯示
        throw new Error(error.message || '與伺服器通訊時發生未知錯誤。');
    } finally {
        // 移除 finally 中的 showLoading(false)，讓主流程控制顯隱
        // showLoading(false);
    }
}