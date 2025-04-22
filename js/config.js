// js/config.js
// 存放遊戲設定相關的常數

// 後端 Worker URL
export const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/'; // 請替換成您的 Worker URL

// --- 版本號 (建議更新) ---
const VERSION = 'v6_preload'; // 使用新版本號避免狀態衝突

// Session Storage Keys
export const GAME_STATE_KEY = `kingdomGameState_${VERSION}`;
export const HISTORY_KEY = `kingdomGameHistory_${VERSION}`;
export const NEXT_TURN_EVENT_KEY = `kingdomGameNextEvent_${VERSION}`; // << 新增：儲存預載的下一回合事件

// 效果延遲與速度 (毫秒)
export const TYPEWRITER_SPEED = 50;       // 打字機速度
export const OPTION_REVEAL_DELAY = 100;   // 主遊戲選項逐個顯示延遲
export const FEEDBACK_REVEAL_DELAY = 150; // 回饋畫面下方內容顯示延遲
export const GAMEOVER_REVEAL_DELAY = 200; // 遊戲結束畫面下方內容顯示延遲
export const NEXT_TURN_CHECK_INTERVAL = 500; // 回饋畫面檢查下一回合資料的間隔 (毫秒)
export const NEXT_TURN_CHECK_TIMEOUT = 15000; // 回饋畫面檢查下一回合資料的超時時間 (毫秒)


// 遊戲規則常數
export const RESOURCE_MIN = 0;
export const RESOURCE_MAX = 10;
export const INITIAL_RESOURCES = { people: 5, army: 5, treasury: 5, faith: 5 };

// 對話歷史最大回合數 (一來一回算 2 條)
export const MAX_HISTORY_TURNS = 50; // 減少一點，避免 prompt 過長 (50 回合 = 100 條記錄)
