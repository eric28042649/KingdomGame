// js/game-logic.js
// 負責核心遊戲邏輯計算

import { RESOURCE_MIN, RESOURCE_MAX, INITIAL_RESOURCES } from './config.js';

/**
 * 應用資源變化，確保值在 0-10 之間
 * @param {object} currentResources - 當前的資源物件 { people, army, treasury, faith }
 * @param {object} changes - 變化的資源物件 { people: 1, treasury: -1, ... }
 * @returns {object} - 更新後的資源物件
 */
export function applyResourceChanges(currentResources, changes) {
    // 如果 currentResources 無效，則從初始值開始計算
    const newResources = { ...(currentResources || INITIAL_RESOURCES) };
    const resourceKeys = ['people', 'army', 'treasury', 'faith'];

    for (const key of resourceKeys) {
        // 確保當前資源值是數字，如果不是則設為初始值
        if (typeof newResources[key] !== 'number') {
            newResources[key] = INITIAL_RESOURCES[key] || 5; // 使用定義的初始值
            console.warn(`資源 ${key} 初始值無效，已重設為 ${newResources[key]}。`);
        }

        // 應用變化
        if (changes && typeof changes[key] === 'number') {
            newResources[key] += changes[key];
        }

        // 限制資源範圍
        newResources[key] = Math.max(RESOURCE_MIN, Math.min(RESOURCE_MAX, newResources[key]));
    }
    console.log("資源變化應用後:", newResources, "變化量:", changes);
    return newResources;
}

/**
 * 檢查遊戲是否結束
 * @param {object} resources - 當前的資源物件
 * @returns {{isOver: boolean, reason: string | null}} - 遊戲結束狀態和原因
 */
export function checkGameOver(resources) {
    if (!resources) {
        console.warn("checkGameOver 收到無效的 resources");
        return { isOver: false, reason: null }; // 如果 resources 無效，則遊戲未結束
    }
    const resourceKeys = ['people', 'army', 'treasury', 'faith'];
    for (const key of resourceKeys) {
        const value = resources[key];
        // 確保比較的是數字
        if (typeof value !== 'number') {
             console.warn(`檢查遊戲結束時資源 ${key} 不是數字: ${value}`);
             continue; // 跳過無效資源
        }
        if (value <= RESOURCE_MIN) {
            console.log(`遊戲結束：資源 ${key} (${value}) 歸零。`);
            return { isOver: true, reason: `${key}_zero` };
        }
        if (value >= RESOURCE_MAX) {
            console.log(`遊戲結束：資源 ${key} (${value}) 溢滿。`);
            return { isOver: true, reason: `${key}_max` };
        }
    }
    return { isOver: false, reason: null }; // 遊戲未結束
}

/**
 * 根據遊戲結束原因生成通用結局文本
 * @param {string | null} reason - 遊戲結束原因代碼 (e.g., "people_zero")
 * @returns {string} - 通用的結局描述文本
 */
export function getGenericEndingText(reason) {
    switch (reason) {
        case "people_zero":
            return "人民離散，人心盡失，您的王國在蕭條中走向終結...";
        case "people_max":
            return "人口過於膨脹，資源耗盡，社會秩序崩潰，您的統治在混亂中落幕...";
        case "army_zero":
            return "軍備廢弛，外敵入侵，您的王國在戰火中化為焦土...";
        case "army_max":
            return "軍隊勢力過於龐大，發動了叛亂，您被推翻，王國落入軍閥之手...";
        case "treasury_zero":
            return "國庫空虛，百業凋敝，您的王國因貧困而分崩離析...";
        case "treasury_max":
            return "財富過度集中，貪腐橫行，社會矛盾激化，您的王朝在奢靡中滅亡...";
        case "faith_zero":
            return "信仰崩塌，道德淪喪，異端邪說四起，您的王國失去了靈魂...";
        case "faith_max":
            return "宗教狂熱席捲全國，神權凌駕於王權之上，您成為了傀儡，王國陷入蒙昧...";
        default:
            return "您的統治走到了終點...";
    }
}
