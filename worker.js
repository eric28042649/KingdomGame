// --- 配置 ---
// 使用的模型 (從使用者代碼獲取)
const MODEL_NAME = "gemini-2.5-flash-preview-04-17"; // 或者 gemini-1.5-pro-latest
// const MODEL_NAME = "gemini-2.0-flash-thinking-exp";
// --- 遊戲主持指令 (使用您提供的更新版本) ---
const GAME_MASTER_INSTRUCTIONS = `
【 給語言模型 API 的遊戲主持指令 (修訂版 V5.5 - JSON 輸出 - 前端計算 - 王國背景) 】

1. 角色定義 (Role Definition):
  你是這款單人策略遊戲的「遊戲主持人」(Game Master)。你的核心職責是：
  * **根據請求類型**執行特定任務（生成背景、生成事件、處理選擇）。
  * **生成**富有想像力的遊戲內容（王國背景、事件描述、選項文本、結果描述）。
  * **預先決定**每個選項會導致的資源變化 (\`resourceChanges\`)。
  * **生成**下一回合的新事件（如果適用）。
  * **務必參考並融入**提供的\`kingdomBackground\`來生成所有事件和描述，確保連貫性。
  * 嚴格按照指定的 JSON 格式進行輸出。
  * 所有的文字描述必須是繁體中文。
  * **你不再負責計算資源的最終值或遞增回合數，也不檢查遊戲結束條件。**

2. 遊戲核心概念 (Game Concept):
  玩家扮演統治者，透過選擇維持四項資源（🧍 人民, 🛡️ 軍隊, 💰 金庫, ✝️ 信仰）的平衡 (1-9)。資源歸零或達到 10 則遊戲結束（由前端檢查）。

3. 核心規則 (Core Rules):
  * 資源: 4 項核心資源，範圍 0-10，初始值 5。
  * 失敗條件: 任一資源達到 0 或 10。(前端檢查)
  * 狀態追蹤: 你需要利用歷史記錄和\`kingdomBackground\`來維持事件的連貫性。

4. 輸入格式 (Expected Input Format):
  你將從外部接收包含以下資訊的 JSON：
  * \`requestType\`: (必需) 字串，指示請求目的 ('generateBackground', 'generateFirstEvent', 'processChoice')。
  * \`kingdomBackground\`: (僅在 'generateFirstEvent' 時由前端提供) 字串，先前生成的王國背景。
  * \`playerAction\`: (僅在 'processChoice' 時提供) 包含 \`chosenOptionId\`。
  * \`currentState\`: (在 'processChoice' 時提供) 包含前端更新後的狀態，例如 \`roundNumber\`, \`resources\`，**以及 \`kingdomBackground\`**。
  * \`limitedHistory\`: (在 'generateFirstEvent' 和 'processChoice' 時提供) 最近的互動歷史。

5. 輸出格式 (Mandatory Output Format):
  你的每一次回應，都"必須"且"只能"是一個符合以下結構之一的 "JSON 物件"。

* **當請求類型為 'generateBackground':**
  \`\`\`json
  {
    "gameState": {
      "kingdomBackground": "..." // 【你生成】一段關於王國的背景描述 (100-150字)
    }
  }
  \`\`\`

* **當請求類型為 'generateFirstEvent':** (生成第一個事件)
  \`\`\`json
  {
    "gameState": {
      "roundNumber": null, // 由前端設置
      "resources": null, // 由前端設置
      "currentEvent": { // 【你生成】第一個事件，需符合 kingdomBackground
        "eventType": "...",
        "stage": null,
        "presentation": "...",
        "description": "...", // 事件描述
        "options": [ // 選項陣列
          {
            "id": "A",
            "text": "...",
            "resourceChanges": { "people": 1, ... } // 【必須提供】效果
          },
          // ... B, C 選項及其效果
        ]
      },
      "lastChoiceResult": null,
      "gameOver": null, // 由前端設置
      "kingdomBackground": null, // Worker 回傳時此項可為 null，前端已有
      "statusMessage": "..." // 【你生成】適合第一回合開始的提示
    }
  }
  \`\`\`

* **當請求類型為 'processChoice':** (處理玩家選擇，返回結果描述和下一事件)
  \`\`\`json
  {
    "gameState": {
      "roundNumber": null, // 由前端設置
      "resources": null, // 由前端設置
      "currentEvent": { ... }, // 【你生成】**下一回合**的新事件 (結構同上，需符合 kingdomBackground)
      "lastChoiceResult": {
        "chosenOptionId": "A", // 從輸入中獲取
        "outcomeText": "...", // 【你生成】對玩家選擇 A 的結果描述 (需符合 kingdomBackground)
        "resourceChanges": null // 你無需提供
      },
      "gameOver": null, // 由前端設置
      "kingdomBackground": null, // Worker 回傳時此項可為 null
      "statusMessage": "..." // 【你生成】適合下一回合開始的提示
    }
  }
  \`\`\`

6. 遊戲流程 (AI 職責 - 根據 requestType):

    * **情況 A：請求類型為 'generateBackground'**
        * **任務：** 生成王國背景。
        * **步驟：**
            1. 構思獨特、富有想像力的奇幻王國背景描述，參考 Section 9。
            2. 嚴格按照 Section 5 的 "generateBackground" 格式輸出 JSON，只包含 \`gameState.kingdomBackground\`。

    * **情況 B：請求類型為 'generateFirstEvent'**
        * **任務：** 生成第一個遊戲事件。
        * **步驟：**
            1. **仔細閱讀**輸入中提供的 \`kingdomBackground\`。
            2. **生成事件內容：** 根據 \`kingdomBackground\` 和 Section 8 指南，構思第一個符合背景設定的事件 (\`description\`, \`eventType\` 等)。
            3. **設計選項及其效果：** 設計 2-3 個選項 (\`text\`)，並為**每個**選項預先確定其 \`resourceChanges\`。選項和效果需與背景及事件描述邏輯一致。
            4. **組裝輸出 JSON (新事件格式)：** 按照 Section 5 的 "generateFirstEvent" 格式輸出。\`lastChoiceResult\` 和 \`kingdomBackground\` 設為 \`null\`。

    * **情況 C：請求類型為 'processChoice'**
        * **任務：** 處理玩家選擇，生成結果描述和下一事件。
        * **步驟：**
            1. **理解選擇上下文：** 獲取 \`playerAction.chosenOptionId\`，並參考輸入的 \`currentState\` (特別是 \`currentState.kingdomBackground\` 和 \`currentState.resources\`) 以及 \`limitedHistory\`。
            2. **生成結果描述 (\`outcomeText\`)：** 根據玩家選擇和**王國背景**，生成一段描述該選擇直接後果的 \`outcomeText\`。
            3. **準備下一回合事件：** 調用 **情況 B 的流程 (Steps 2 & 3)**，但這次是基於當前的完整上下文（包括歷史和背景）來生成一個**全新的、符合背景的**下一回合事件 (\`currentEvent\`)。
            4. **組裝輸出 JSON (處理結果格式)：** 按照 Section 5 的 "processChoice" 格式輸出。創建 \`lastChoiceResult\` (包含 \`chosenOptionId\` 和 \`outcomeText\`)，放入新的 \`currentEvent\`。\`kingdomBackground\` 設為 \`null\`。

7. 遊戲開始 (Game Start):
    遊戲開始由前端發起兩次呼叫：第一次獲取背景 (\`generateBackground\`)，第二次獲取首個事件 (\`generateFirstEvent\`)。

8. 事件設計與呈現指南 (Event Content Generation Guide):
  * "事件": 情境描述 (Description): 一段文字，從您（國王）的視角出發，描述一個王國中正在面臨的機遇、發生的狀況、收到的消息或出現的問題，積極提供正向的事件。
  *  **【重要】** 循序漸進，熟悉環境： 開局前三回合 (roundNumber <= 3) 在相對 "輕鬆" 的氛圍中，逐漸熟悉本局遊戲獨特的王國背景（例如地理、文化、特色資源），禁止出現 "不安"、"未知"、"異常" 等負面字眼。
  * 建立治理節奏： 開局前三回合 (roundNumber <= 3) 從處理細微末節開始，側重於處理王國內部的日常瑣事或地方性事務，再逐步面對更宏大的挑戰。
  * 世界觀設定 (World Setting): 本遊戲設定於一個架空的中世紀奇幻世界 (以下範例僅供參考，請自行舉例常見的奇幻概念與設定)。
    * 魔法元素 (Magic Elements): 事件和選項應經常性地融入魔法概念。範例： 奧術魔法、神聖魔法、元素魔法 ( 火、水、土、氣)、亡靈法術、煉金術、附魔、符文、祝福、幻術、預言、魔藥、魔法捲軸、法師塔、能量節點等等。
    * 奇幻生物 (Mythical Creatures): 積極地將各種奇幻生物納入事件中。範例： 龍 (Dragons)、精靈 (Elves)、矮人 (Dwarves)、獸人 (Orcs)、哥布林 (Goblins)、巨人 (Giants)、食人妖 (Trolls)、不死生物 (Undead: 骷髏、殭屍、幽靈)、元素生物 (Elementals)、獅鷲 (Griffins)、獨角獸 (Unicorns)、人魚 (Merfolk)、娜迦 (Naga)、魔像 (Golems)、奇美拉 (Chimera)、樹人 (Treants)。事件可涉及戰鬥、外交、共存、馴養或狩獵。
    * 奇幻種族 (Fantasy Races): 除了常見的精靈、矮人、獸人外，也可考慮加入 半身人 (Halflings)、地侏 (Gnomes)、龍裔 (Dragonborn)、提夫林 (Tieflings)、各種獸人 (Beastfolk) 等，作為王國的居民或鄰邦。
    * 奇幻地點與傳說 (Fantasy Locations & Lore): 事件可以發生在或涉及到典型的奇幻地點。範例： 受詛咒的森林 (Cursed Forests)、古代廢墟 (Ancient Ruins)、浮空島 (Floating Islands)、地底王國 (Underdark Realms)、元素位面入口 (Planar Gates)、火山之心 (Volcanic Hearts)、妖精荒野 (Feywild)、失落的神殿 (Lost Temples)。可適度引用或創造關於預言 (Prophecies)、神器 (Artifacts)、創世神話 (Creation Myths)、古老邪惡 (Ancient Evils)、諸神之戰 (Wars of the Gods) 等背景傳說。
    * 奇幻概念/組織 (Fantasy Concepts/Organizations): 可涉及 魔法學院 (Mage Academies)、騎士團 (Knightly Orders)、神殿教派 (Temples/Cults)、盜賊公會 (Thieves' Guilds)、煉金術士協會 (Alchemists' Guilds)、怪物獵人 (Monster Hunters)、魔力/法力 (Mana) 的概念等。
    * 影響整合: 奇幻元素必須與核心資源產生邏輯關聯。例如：招募龍騎士會消耗 treasury 但可能提升 army；發現魔法礦脈可能提升 treasury 但引來覬覦（影響 army 或 people）。
  * **【重要】** 後果邏輯 (Consequence Logic):
      * 在生成每個選項 (A, B, C) 的文本時，**必須同時確定並提供**其對應的 \`resourceChanges\`。
      * 資源影響需符合選項描述的邏輯，數值範圍建議 +/- 2 (次要事件 +/- 1 或 0，重大事件可稍高)。
      * 你生成的 \`outcomeText\` 應與你為該選項設定的 \`resourceChanges\` 在敘事上保持一致。
  *  **【重要】** 所有事件、選項與結果描述必須且只能以 "繁體中文" 來呈現。
  * 僅在玩家做出選擇後的下一回合，於 lastChoiceResult 中報告該選擇的資源影響。
  * 事件類型 (Event Types):
    * 重大事件 (Major Events): 涉及國家層面的重要事務。對資源有較大影響（+/- 2 或更多，需平衡）。
    * 次要事件 (Minor Events): 涉及個人請求、宮廷生活、地方小事等。對資源影響非常微小（+/- 1 或 0）。
    * 生成混合 (Mix): 確保遊戲中包含這兩種類型的事件，自然穿插。
  * 事件生成建議: 
    * **【重要】** 積極設計 "多階段事件"，可以多設計一個較大事件或故事線，並拆分成連續多個回合來展現和解決，出現多階段事件時，故事應要有起承轉合，每回合推進故事的一部份進度。  
    * **【重要】** 第一人稱接收視角： 在撰寫事件描述時，始終從「信息被呈遞給統治者」的角度出發，並盡可能點明是誰或以何種方式將信息傳達給玩家，增加代入感。
    * 可以讓事件的發生與當前王國的資源狀況相聯繫，例如當某項資源過低時，相關事件的出現給予「對症下藥」的機會，讓資源管理更具策略性。
    * 可以依據過去發生的事件來生成衍生事件，玩家的選擇可能在數個回合之後，以一個全新的衍生事件的形式，回饋到玩家身上。例如，早期若選擇了資助某個商人行會，後期可能觸發該行會回報您，或反過來因其實力壯大而產生新的問題。
    * 在處理某些選項時，有機率觸發一個與選項描述不完全一致、但影響重大的「特殊結果」，多數是正面的，增加遊戲的驚喜感，例如選擇例行性的打掃倉庫，結果卻發現了失傳的國寶。
    * 前面回合消耗資源執行的動作，可以以某種形式的獎勵回饋給玩家，在生成事件時，應參考歷史記錄 (limitedHistory) 中玩家先前付出的重大資源投入（如大型建設、研究、外交）。基於這些投入，應適時觸發能帶來相關正面回報（如資源增加、特殊增益、降低成本）的後續事件，確保回報邏輯合理。
    * 延遲滿足機制 (Delayed Gratification Mechanism): 確保遊戲不僅有即時的挑戰與消耗，也包含因先前明智投入而在後續回合獲得獎勵的可能性，以體現長遠規劃的價值。
    * 資源平衡考量 (Resource Balancing Considerations):
      * 選項成本多樣化 (Diversify Option Costs): 在設計事件選項的後果時，務必確保資源變化的多樣性。避免過於頻繁地讓多個選項都消耗金庫。 應積極設計影響其他資源（如 🧍 人民、🛡️ 軍隊、✝️ 信仰）的增減或幾乎無變化（但可能有其他風險或效果較差）的選項。
      * 提供非金錢解決方案 (Offer Non-Monetary Solutions): 鼓勵生成代表外交手腕、利用軍隊人力、訴諸信仰力量、提升管理效率或依靠民眾力量來解決問題的選項，而不僅僅是花錢。
      * 增加金庫收入機會 (Provide Treasury Income Opportunities): 除了節流，也要考慮開源。適時生成可以透過貿易、稅收、投資、發現資源等方式增加金庫的事件和選項。
      * 考量當前資源水平 (Consider Current Resource Levels): 在設計選項成本時，應參考當前的資源狀況。例如，若金庫已然很低，則需要大量金錢的選項應減少出現頻率，或在選項文字中明確其高風險性。
9. 王國背景生成 (Kingdom Background Generation):
     * 當收到 \`requestType: 'generateBackground'\` 的請求時，你的唯一任務是生成一段關於這個奇幻王國的背景描述。你的輸出**必須**是以下 JSON 格式：\`{ "gameState": { "kingdomBackground": "..." } }\`。不要包含任何其他 \`gameState\` 欄位。
     * 必須先生成一段具體、獨特且包含至少三項關鍵要素的王國背景描述。這些要素應涵蓋：
       * 地理/環境特色： 明確王國的主要地理環境（例如：位於『迷霧山脈』的礦業王國，坐擁『翡翠港』的沿海貿易城邦，處於『低語森林』邊緣、與自然共生的聚落，被『龍骨沙漠』環繞的綠洲城邦）。
       * 核心主題/特長： 點明王國最顯著的特徵或專長（例如：以強大的『皇家法師團』或古老的『德魯伊教團』聞名，擁有繁榮但腐敗的『黃金商會』，是精於鍛造的『矮人堡壘』，信奉嚴苛『戰神』的尚武國度）。
       * (可選) 主要種族/文化： 提及王國的主要居民種族及其文化特點（例如：由注重傳統的矮人統治，人類與精靈混居但關係緊張，受到鄰近龍族或元素位面的影響）。 此生成的背景描述必須包含在初始 gameState JSON 的一個新增欄位（例如 kingdomBackground: { description: "..." }）中，供網頁顯示及模型後續參考。
`; // <<< 指令結束


// --- Worker Fetch Handler ---
export default {
  async fetch(request, env, ctx) {
    // --- CORS 處理 ---
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // --- 環境變數檢查 ---
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return new Response(JSON.stringify({ error: "未設定 GEMINI_API_KEY" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    // --- 處理請求 ---
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: '只接受 POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });

    let requestType = null;
    let kingdomBackground = null; // For generateFirstEvent
    let playerAction = null;
    let currentState = null; // Includes kingdomBackground for processChoice
    let limitedHistory = [];

    try {
      const requestData = await request.json();
      if (requestData) {
          requestType = requestData.requestType || null;
          kingdomBackground = requestData.kingdomBackground || null; // Only for generateFirstEvent
          playerAction = requestData.playerAction || null;
          currentState = requestData.currentState || null; // Includes background for processChoice
          // 驗證 history 是否為陣列
          if (Array.isArray(requestData.limitedHistory)) {
              limitedHistory = requestData.limitedHistory.filter(turn =>
                  (turn.role === 'user' || turn.role === 'model') &&
                  Array.isArray(turn.parts) &&
                  turn.parts.length > 0 &&
                  typeof turn.parts[0].text === 'string'
              );
          }
      }
       console.log("Worker 收到請求 (v5.5):", { requestType, hasKingdomBackground: !!kingdomBackground, hasPlayerAction: !!playerAction, hasCurrentState: !!currentState, historyLength: limitedHistory.length });

       if (!requestType) {
            throw new Error("請求中缺少 'requestType' 欄位。");
       }

    } catch (e) {
      console.error("解析請求 Body 失敗或缺少 requestType (v5.5):", e);
      return new Response(JSON.stringify({ error: `請求解析錯誤或缺少 requestType: ${e.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });
    }

    // --- 建構發送給 Gemini API 的 contents ---
    const geminiContents = [];

    // 1. 添加遊戲主持指令
    geminiContents.push({
        role: "user",
        parts: [{ text: GAME_MASTER_INSTRUCTIONS }]
    });
     // *** 添加一個空的 model 回應，模擬多輪對話的開始 ***
     geminiContents.push({
        role: "model",
        parts: [{ text: "好的，我已經理解了作為遊戲主持人的規則和任務。請提供請求內容。" }] // 或其他確認性文字
    });


    // 2. 根據 requestType 添加特定內容
    try {
        switch (requestType) {
            case 'generateBackground':
                // 只需請求背景
                geminiContents.push({
                    role: "user",
                    parts: [{ text: JSON.stringify({ requestType: 'generateBackground' }) }]
                });
                console.log("準備請求生成背景。");
                break;

            case 'generateFirstEvent':
                if (!kingdomBackground) throw new Error("'generateFirstEvent' 請求缺少 'kingdomBackground'。");
                // 添加背景作為上下文
                geminiContents.push({
                    role: "user",
                    parts: [{ text: `這是王國的背景設定，請基於此生成第一個事件：\n---\n${kingdomBackground}\n---\n請求類型：'generateFirstEvent'` }]
                     // parts: [{ text: JSON.stringify({ requestType: 'generateFirstEvent', kingdomBackground: kingdomBackground }) }] // 也可以這樣傳遞
                });
                 // 添加有限的歷史記錄 (此時應為空)
                if (limitedHistory.length > 0) {
                    geminiContents.push(...limitedHistory); // 理論上此處 history 應為空
                    console.log(`添加了 ${limitedHistory.length} 條歷史記錄到 prompt (generateFirstEvent)。`);
                 }
                console.log("準備基於背景請求生成第一個事件。");
                break;

            case 'processChoice':
                if (!playerAction) throw new Error("'processChoice' 請求缺少 'playerAction'。");
                if (!currentState) throw new Error("'processChoice' 請求缺少 'currentState'。");
                if (!currentState.kingdomBackground) throw new Error("'currentState' 中缺少 'kingdomBackground'。");

                // 添加背景上下文 (每次都加，確保 AI 記得)
                 geminiContents.push({
                     role: "user",
                     parts: [{ text: `當前王國背景設定（請務必參考）：\n---\n${currentState.kingdomBackground}\n---` }]
                 });
                 // 添加 model 回應以保持對話結構
                 geminiContents.push({ role: "model", parts: [{ text: "好的，我會參考這個背景。" }] });

                // 添加歷史記錄
                if (limitedHistory.length > 0) {
                     // 過濾掉可能重複的背景提示 (如果歷史中已包含)
                     const filteredHistory = limitedHistory.filter(turn => !turn.parts[0].text.includes("當前王國背景設定"));
                     geminiContents.push(...filteredHistory);
                    console.log(`添加了 ${filteredHistory.length} 條過濾後的歷史記錄到 prompt (processChoice)。`);
                }

                // 添加當前狀態和玩家行動
                geminiContents.push({
                    role: "user",
                    // 將多個資訊合併到一個 user turn 中
                     parts: [{ text: `基於以上背景和歷史，玩家在回合 ${currentState.roundNumber} (資源: ${JSON.stringify(currentState.resources)}) 時選擇了選項 ${playerAction.chosenOptionId}。\n請生成結果描述 (\`outcomeText\`) 和下一回合的新事件 (\`currentEvent\`)。\n請求類型：'processChoice'` }]
                    // parts: [{ text: JSON.stringify({ requestType: 'processChoice', currentState: currentState, playerAction: playerAction }) }] // 也可以這樣傳遞
                });
                console.log("準備基於背景、歷史和選擇請求生成結果和下一事件。");
                break;

            default:
                throw new Error(`無法識別的 requestType: ${requestType}`);
        }
    } catch (buildError) {
        console.error("構建 Gemini 請求內容時出錯 (v5.5):", buildError);
        return new Response(JSON.stringify({ error: `構建請求錯誤: ${buildError.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });
    }


    // --- 準備呼叫 Gemini API ---
    const geminiRequestBody = {
      contents: geminiContents,
      generationConfig: {
        responseMimeType: "application/json", // 保持要求 JSON 輸出
        // maxOutputTokens: 8192, // 可選：保持較大的輸出限制
         temperature: 0.7 // 可選: 調整溫度以獲得更多樣化的結果
      },
      // safetySettings: [ ... ] // 可選: 配置安全設置
    };

    console.log("準備發送給 Gemini (v5.5) (部分內容):", {
        contentsLength: geminiContents.length,
        requestType: requestType,
        lastHistoryRole: limitedHistory[limitedHistory.length - 1]?.role,
        playerActionIncluded: !!playerAction
    });
    // console.log("完整的 Gemini Request Body:", JSON.stringify(geminiRequestBody, null, 2)); // Debugging: 打印完整請求

    try {
      // 呼叫 Gemini API
      const geminiResponse = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiRequestBody),
      });

      if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error("Gemini API 錯誤 (v5.5):", geminiResponse.status, errorText);
          // 嘗試解析更詳細的錯誤
           let detailedError = errorText;
           try {
                const errorJson = JSON.parse(errorText);
                detailedError = errorJson.error?.message || errorText;
           } catch(e) {/* 解析失敗 */}
          throw new Error(`Gemini API 錯誤 (${geminiResponse.status}): ${detailedError}`);
        }

      // --- 解析 Gemini API 的回應 ---
      const geminiApiResponse = await geminiResponse.json();

      // 增加對 Gemini 可能返回無候選內容或錯誤的檢查
      if (!geminiApiResponse.candidates || geminiApiResponse.candidates.length === 0) {
           console.error("Gemini API 回應缺少 candidates (v5.5):", geminiApiResponse);
           const blockReason = geminiApiResponse.promptFeedback?.blockReason;
           const safetyRatings = JSON.stringify(geminiApiResponse.promptFeedback?.safetyRatings || {});
           throw new Error(`Gemini API 未返回有效候選內容。${blockReason ? `原因: ${blockReason}` : ''} 安全評級: ${safetyRatings}`);
       }
        // 檢查 finishReason
       const finishReason = geminiApiResponse.candidates[0]?.finishReason;
       if (finishReason && finishReason !== "STOP") {
           console.warn(`Gemini API 返回的 finishReason 不是 STOP: ${finishReason}`, geminiApiResponse.candidates[0]?.safetyRatings);
           // 根據需要可以決定是否拋出錯誤，或者繼續處理 (如果部分內容可用)
           if (finishReason === "SAFETY") {
                throw new Error(`Gemini 因為安全設定中止了生成。安全評級: ${JSON.stringify(geminiApiResponse.candidates[0]?.safetyRatings)}`);
           } else if (finishReason === "MAX_TOKENS") {
                console.warn("Gemini 因為達到最大 token 限制而中止，可能內容不完整。");
           }
       }

      let generatedText = null;
      try { generatedText = geminiApiResponse?.candidates?.[0]?.content?.parts?.[0]?.text; } catch (e) { throw new Error('無法從 Gemini 回應中提取有效的遊戲狀態文字 (結構錯誤)。'); }
      if (!generatedText) throw new Error('無法從 Gemini 回應中提取有效的遊戲狀態文字 (內容為空)。');

      console.log("從 Gemini 提取的原始文字 (v5.5):", generatedText);
      let cleanedJsonText = generatedText.replace(/^```json\s*|```$/g, '').trim();
      cleanedJsonText = cleanedJsonText.replace(/\u00A0/g, ' '); // 清理非標準空白
      console.log("清理後的 JSON 文本 (v5.5):", cleanedJsonText);

      let parsedResponse;
      try {
          parsedResponse = JSON.parse(cleanedJsonText);
          // 基本驗證：必須是物件且包含 gameState
          if (typeof parsedResponse !== 'object' || parsedResponse === null || !parsedResponse.gameState) {
              throw new Error('解析出的 JSON 結構不符合預期 (缺少 gameState)。');
          }
          // 針對特定請求類型的進一步驗證
          if (requestType === 'generateBackground' && typeof parsedResponse.gameState.kingdomBackground !== 'string') {
              throw new Error('generateBackground 回應缺少 kingdomBackground 字串。');
          }
           if ((requestType === 'generateFirstEvent' || requestType === 'processChoice') && typeof parsedResponse.gameState.currentEvent !== 'object') {
               // For processChoice, if game ends, currentEvent might be null, handle later?
               if (!parsedResponse.gameState.lastChoiceResult) // If it's not processChoice response, currentEvent is mandatory
                    throw new Error(`${requestType} 回應缺少 currentEvent 物件。`);
           }
           if (requestType === 'processChoice' && typeof parsedResponse.gameState.lastChoiceResult !== 'object') {
                throw new Error('processChoice 回應缺少 lastChoiceResult 物件。');
           }

      } catch (parseError) {
          console.error("解析清理後的 JSON 文本時出錯 (v5.5):", parseError, cleanedJsonText);
          throw new Error(`無法解析遊戲狀態 JSON: ${parseError.message}。清理後的文本: ${cleanedJsonText}`);
      }

      console.log(`成功解析 ${requestType} 的遊戲狀態 gameState (v5.5)。`);
      // --- 返回結果 ---
      return new Response(JSON.stringify(parsedResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });

    } catch (error) {
      // --- 錯誤處理 ---
      console.error(`Worker 處理請求 (${requestType}) 時發生錯誤 (v5.5):`, error);
      return new Response(JSON.stringify({ error: `處理請求 (${requestType}) 時發生錯誤: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json;charset=UTF-8' } });
    }
  },
};