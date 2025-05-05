import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { Player } from "@/interfaces/database";
import { PokemonInstance } from "@/interfaces/pokemon";
import { getPokedexSummary, PokedexEntry } from "@/lib/gameData";

// Assuming this is moved from game.ts or defined here
// TODO: Move this to a shared constants file, e.g., src/game/gameConstants.ts
const moveTypeToFileMap: { [key: string]: string } = {
    '一般': '一般', 'normal': '一般',
    '火': '火', 'fire': '火',
    '水': '水', 'water': '水',
    '电': '电', 'electric': '电',
    '草': '草', 'grass': '草',
    '冰': '冰', 'ice': '冰',
    '格斗': '格斗', 'fighting': '格斗',
    '毒': '毒', 'poison': '毒',
    '地面': '地面', 'ground': '地面',
    '飞行': '飞行', 'flying': '飞行',
    '超能力': '超能力', 'psychic': '超能力',
    '虫': '虫', 'bug': '虫',
    '岩石': '岩石', 'rock': '岩石',
    '幽灵': '幽灵', 'ghost': '幽灵',
    '龙': '龙', 'dragon': '龙',
    '恶': '恶', 'dark': '恶',
    '钢': '钢', 'steel': '钢',
    '妖精': '妖精', 'fairy': '妖精',
};

/**
 * Handles the AI interaction for a Pokemon training session.
 * 
 * @param playerState Current state of the player (needed for context, team).
 * @param targetPokemonIndex Index of the Pokemon being trained in the player's team.
 * @param targetType The desired attribute type for move learning.
 * @param focusDescription The player-provided description of the training focus.
 * @param usingItem Optional item used during training.
 * @param grokClient Initialized OpenAI client for Grok API.
 * @returns Promise resolving to the AI's output message or an error message.
 */
export async function initiateTrainingSession(
    playerState: Player,
    targetPokemonIndex: number,
    targetType: string,
    focusDescription: string,
    usingItem: string | undefined,
    grokClient: OpenAI | null
): Promise<string> { 
    
    const foundTarget = playerState.team?.[targetPokemonIndex];
    if (!foundTarget) {
        return `错误：在队伍中找不到索引为 ${targetPokemonIndex + 1} 的宝可梦。`; // Should not happen if called correctly
    }
    if (!grokClient) {
        return "错误：AI 服务未初始化 (缺少 API Key?)";
    }

    try {
        // 1. Map targetType to filename
        const targetTypeLower = targetType.toLowerCase();
        const moveListFilenameBase = moveTypeToFileMap[targetTypeLower];
        if (!moveListFilenameBase) {
            throw new Error(`未知的招式属性: ${targetType}`);
        }
        const moveListFilename = `${moveListFilenameBase}.txt`;
        // Construct path relative to project root (assuming utils is in src/game)
        const moveListPath = path.join(process.cwd(), 'data', 'move_lists_by_type', moveListFilename);

        // 2. Read the move list file
        let moveList: string[] = [];
        try {
            const fileContent = await fs.readFile(moveListPath, 'utf-8');
            moveList = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
            if (moveList.length === 0) {
                console.warn(`Warning: Move list file is empty: ${moveListPath}`);
            }
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.warn(`Warning: Move list file not found: ${moveListPath}.`);
            } else {
                throw new Error(`读取招式列表文件时出错 (${moveListFilename}): ${err.message}`);
            }
        }
        
        // 3. Get Pokemon Species Summary Info
        const pokedexSummaryArray = await getPokedexSummary(); 
        // Correct the type hint to match getPokedexSummary return type
        const speciesSummary = pokedexSummaryArray.find((p: Pick<PokedexEntry, 'yudex_id' | 'name'>) => p.yudex_id === foundTarget.pokedexId);
        const speciesName = speciesSummary?.name || `宝可梦 #${foundTarget.pokedexId}`;
        // We don't have types in summary, use placeholder or load details if needed later
        const speciesTypes = '未知'; // Or load details: const details = await getPokemonSpeciesDetails(foundTarget.pokedexId); speciesTypes = details?.types?.join('/') || '未知';

        // 4. Build the Prompt (Uses speciesName and the placeholder speciesTypes now)
        const promptTemplate = `扮演一位经验丰富的宝可梦训练大师。一位训练家正在训练他们的 ${foundTarget.nickname || speciesName} (Lv. ${foundTarget.level})，这是一只 ${speciesTypes} 属性的 ${speciesName}。训练家使用了 ${usingItem || '无特定道具'}，并希望重点关注 "${focusDescription}"。

训练家希望宝可梦能学习 **${moveListFilenameBase}** 属性的招式。请**严格**从以下提供的**该属性的招式列表**中进行选择，模拟这次训练最可能带来的**一个**招式学习结果。

**${moveListFilenameBase} 招式列表:**
${moveList.length > 0 ? moveList.map(m => `- ${m}`).join('\n') : '(无可用招式列表)'}

**重要原则:**
*   推荐的招式必须与训练重点、使用的道具（如有）、宝可梦的类型和潜力有明确的逻辑关联。
*   学习强力招式应该是**困难且罕见**的，仅在训练重点和道具提供极强支持时才可考虑推荐，并需要给出合理解释。大多数情况下，应优先考虑符合宝可梦当前发展阶段和属性的招式。
*   如果列表中没有绝对合适的招式可以推荐，或者训练不足以领悟新招式，请明确说明。

**输出格式:**
*   如果推荐新招式，请使用："经过这次训练，专注于 ${focusDescription}，你的 ${foundTarget.nickname || speciesName} 似乎领悟了 **[新招式名称]**！[可选的解释理由]"
*   如果未能领悟新招式，请使用："这次训练让 ${foundTarget.nickname || speciesName} 更加熟练了，但似乎还没有领悟新的招式。"`;

        // 5. Call Grok API
        console.log("--- Sending Prompt to Grok ---");
        // console.log(promptTemplate); // Uncomment to debug prompt
        console.log("-----------------------------");
        
        const completion = await grokClient.chat.completions.create({
            model: "grok-3-mini-beta", 
            messages: [
                { role: "system", content: promptTemplate }
            ],
            temperature: 1, 
        });

        const aiResponse = completion.choices[0].message.content;
        
        // TODO: Parse aiResponse to detect new move suggestion
        // TODO: Update the actual pokemon instance state if move is learned (requires returning updated instance or modifying reference)

        return aiResponse || "AI 没有返回任何响应。";

    } catch (error: any) {
        console.error("训练 AI 交互出错:", error);
        return `训练过程中出现错误: ${error.message || '未知错误'}`;
    }
}

// Potential future functions:
// - parseAiTrainingResponse(response: string): { learnedMove?: string, replaceMove?: string } | null
// - updatePokemonMoves(...) 