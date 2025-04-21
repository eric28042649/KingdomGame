// js/config.js
// 存放遊戲設定相關的常數

// 後端 Worker URL
export const WORKER_URL = 'https://square-mountain-5ffb.eric10041004.workers.dev/'; // 請替換成您的 Worker URL

// Session Storage Keys
export const GAME_STATE_KEY = 'kingdomGameState_v5';
export const HISTORY_KEY = 'kingdomGameHistory_v5';
export const MAX_HISTORY_TURNS = 100;

// 效果延遲與速度 (毫秒)
export const TYPEWRITER_SPEED = 50;
export const OPTION_REVEAL_DELAY = 150;
export const FEEDBACK_REVEAL_DELAY = 200;
export const GAMEOVER_REVEAL_DELAY = 300;

// 遊戲規則常數
export const RESOURCE_MIN = 0;
export const RESOURCE_MAX = 10;
export const INITIAL_RESOURCES = { people: 5, army: 5, treasury: 5, faith: 5 };
