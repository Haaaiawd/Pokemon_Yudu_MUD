import { BattleAction, BattleState, BattleParticipant } from '@/interfaces/battle';
import { PokemonInstance, Move } from '@/interfaces/pokemon';
import { PokedexEntry, getPokemonSpeciesDetails, getMoves, Item } from '@/lib/gameData';
import { v4 as uuidv4 } from 'uuid';
import { getTypeEffectiveness, TypeChart } from './typeUtils';
import { getNatureModifier, NATURES, StatName } from '@/constants/natures';

// --- Constants ---

// Status Condition Modifiers for Catch Rate
const StatusCatchBonus: { [status: string]: number } = {
    PAR: 1.5, // Paralysis
    PSN: 1.5, // Poison
    BRN: 1.5, // Burn
    SLP: 2.5, // Sleep
    FRZ: 2.5, // Freeze
    default: 1.0,
};

// Status Condition Speed Modifiers (Add this)
const StatusSpeedModifier: { [status: string]: number } = {
    PAR: 0.5, // Paralysis halves speed
    default: 1.0,
};

// --- Helper Functions (Ensure they are defined before processTurn or properly exported/imported if moved) ---

/**
 * Calculates the damage dealt by a move.
 */
async function calculateDamage(
    attacker: PokemonInstance,
    defender: PokemonInstance,
    move: Move // Use the imported Move type
): Promise<{ damage: number; effectivenessMessage: string | null; isCritical: boolean }> {
    // ... (move validation - ensure move.power etc. exist before use) ...
    if (!move || typeof move.power !== 'number' || typeof move.pp !== 'number' || !move.type || !move.category) {
        console.error(`Invalid move data for calculation:`, move);
        return { damage: 0, effectivenessMessage: null, isCritical: false };
    }

    const level = attacker.level;
    const power = move.power;

    let attackStat = move.category === 'Special' ? attacker.calculatedStats.spAttack : attacker.calculatedStats.attack;
    const defenseStat = move.category === 'Special' ? defender.calculatedStats.spDefense : defender.calculatedStats.defense;

    if (move.category === 'Physical' && attacker.statusCondition === 'BRN') {
        attackStat = Math.floor(attackStat / 2);
    }

    if (power <= 0) { // power is checked for null/undefined above
        return { damage: 0, effectivenessMessage: null, isCritical: false };
    }
    let damage = Math.floor((((2 * level / 5 + 2) * power * attackStat / defenseStat) / 50) + 2);

    // Modifiers
    let modifier = 1.0;
    const isCritical = Math.random() < (1 / 24);
    if (isCritical) { modifier *= 1.5; }
    
    // Get attacker types with fallback to empty array if undefined
    const attackerTypes = attacker.speciesDetails?.types || [];
    // Check for STAB (Same Type Attack Bonus)
    if (attackerTypes.includes(move.type)) { modifier *= 1.5; }
    
    // Get defender types with fallback to empty array if undefined
    const defenderTypes = defender.speciesDetails?.types || [];
    const effectiveness = getTypeEffectiveness(move.type, defenderTypes);
    
    modifier *= effectiveness;
    let effectivenessMessage: string | null = null;
    if (effectiveness > 1) effectivenessMessage = "It's super effective!";
    else if (effectiveness < 1 && effectiveness > 0) effectivenessMessage = "It's not very effective...";
    else if (effectiveness === 0) effectivenessMessage = "It doesn't affect the opponent...";

    damage = Math.floor(damage * modifier * (Math.random() * 0.15 + 0.85));

    if (effectiveness > 0 && damage < 1) damage = 1;
    if (effectiveness === 0) damage = 0;

    return { damage, effectivenessMessage, isCritical };
}

/**
 * Calculates the probability of catching a Pokemon.
 */
async function calculateCatchRate(
    target: PokemonInstance,
    ball: Item // Use imported Item type
): Promise<boolean> {
    const speciesCatchRate = target.speciesDetails?.catchRate ?? 45; // Default to medium catch rate (45)
    const ballBonus = ball.ballBonus ?? 1.0;
    const statusBonus = StatusCatchBonus[target.statusCondition || 'default'] ?? 1.0;

    if (typeof speciesCatchRate !== 'number') {
        console.error("Target Pokemon species catch rate is undefined or not a number!");
        return false;
    }

    const maxHP = target.calculatedStats.hp;
    const currentHP = target.currentHp;

    const a = Math.floor(((3 * maxHP - 2 * currentHP) * speciesCatchRate * ballBonus * statusBonus) / (3 * maxHP));
    const catchProbability = Math.max(1, a) / 255;

    console.log(`Catch calc: MaxHP=${maxHP}, CurrHP=${currentHP}, Rate=${speciesCatchRate}, Ball=${ballBonus}, Status=${statusBonus}, a=${a}, Prob=${catchProbability}`);
    return Math.random() < catchProbability;
}

// ... (startBattle function definition should be here if not imported) ...

/**
 * Processes a single turn of the battle.
 */
export async function processTurn(
    currentBattleState: BattleState,
    playerAction: BattleAction,
    opponentAction: BattleAction // Simplified: Assume opponent always chooses FIGHT for now
): Promise<BattleState> {
    // ... (logging start) ...

    let nextState = { ...currentBattleState };
    // ... (deep copy state) ...
    let playerParticipant = nextState.participants[0];
    let opponentParticipant = nextState.participants[1];

    // --- Action Resolution Order (simplified: speed check first) ---
    const playerPokemon = playerParticipant.activePokemon;
    const opponentPokemon = opponentParticipant.activePokemon;

    // Apply speed modifiers (e.g., for Paralysis)
    const playerSpeedMod = StatusSpeedModifier[playerPokemon.statusCondition || 'default'] ?? 1.0;
    const opponentSpeedMod = StatusSpeedModifier[opponentPokemon.statusCondition || 'default'] ?? 1.0;

    const playerEffectiveSpeed = playerPokemon.calculatedStats.speed * playerSpeedMod;
    const opponentEffectiveSpeed = opponentPokemon.calculatedStats.speed * opponentSpeedMod;

    console.log(`${playerPokemon.speciesName} effective speed: ${playerEffectiveSpeed} (Base: ${playerPokemon.calculatedStats.speed}, Mod: ${playerSpeedMod})`);
    console.log(`${opponentPokemon.speciesName} effective speed: ${opponentEffectiveSpeed} (Base: ${opponentPokemon.calculatedStats.speed}, Mod: ${opponentSpeedMod})`);


    const actionsInOrder: { participantIndex: number; action: BattleAction }[] = [];

    // ... (Priority handling based on action type - RUN, SWITCH) ...

    // --- Item usage priority needs refinement (e.g., Quick Claw) ---
    // For now, use *effective* speed check for FIGHT vs FIGHT or FIGHT vs ITEM
    if (playerEffectiveSpeed >= opponentEffectiveSpeed) { // Use effective speed
        actionsInOrder.push({ participantIndex: 0, action: playerAction });
        actionsInOrder.push({ participantIndex: 1, action: opponentAction });
    } else {
        actionsInOrder.push({ participantIndex: 1, action: opponentAction });
        actionsInOrder.push({ participantIndex: 0, action: playerAction });
    }

    nextState.log.push(`--- Turn ${nextState.turn} ---`);
    const currentTurnNumber = nextState.turn; // Store turn number for end-of-turn effects
    nextState.turn++;


    // --- Process Actions in Order ---
    for (const { participantIndex, action } of actionsInOrder) {
        const actor = nextState.participants[participantIndex];
        const target = nextState.participants[1 - participantIndex];
        const actorPokemon = actor.activePokemon;
        const targetPokemon = target.activePokemon;

        // Check if actor fainted before its turn
        if (actorPokemon.currentHp <= 0 && action.type !== 'SWITCH') {
            // ... (fainted logic) ...
            continue;
        }

        // Check if battle ended from previous action
        if (nextState.status !== 'WAITING_FOR_INPUT' && nextState.status !== 'PROCESSING') {
             break;
        }
        nextState.status = 'PROCESSING';

        // --- Pre-Action Status Checks (e.g., Sleep, Freeze, Paralysis) ---
        if (actorPokemon.statusCondition === 'PAR') {
            // Check for full paralysis (25% chance)
            if (Math.random() < 0.25) {
                nextState.log.push(`${actorPokemon.nickname || actorPokemon.speciesName} is fully paralyzed! It can't move!`);
                continue; // Skip the rest of the action
            }
        }
        // TODO: Add checks for SLP (wake up chance), FRZ (thaw chance) here


        switch (action.type) {
            case 'FIGHT':
                const move: Move | undefined = actorPokemon.moves.find((m: Move) => m.name === action.moveId);
                if (!move) {
                     // ... (move not found logic) ...
                     continue;
                }
                 if (move.pp <= 0) {
                    // ... (no PP logic) ...
                    continue;
                 }

                move.pp--;

                nextState.log.push(`${actor.name}'s ${actorPokemon.nickname || actorPokemon.speciesName} used ${move.name}!`);

                // --- Check Accuracy (placeholder, needs move accuracy data) ---
                // const accuracyCheck = (move.accuracy === null || Math.random() * 100 < move.accuracy);
                // if (!accuracyCheck) {
                //     nextState.log.push(`But it missed!`);
                //     continue; // Skip damage and effects if missed
                // }

                // Calculate Damage
                const { damage, effectivenessMessage, isCritical } = await calculateDamage(actorPokemon, targetPokemon, move);

                // ... (Log critical hit, effectiveness) ...

                if (damage > 0) {
                     // Apply Damage
                     targetPokemon.currentHp = Math.max(0, targetPokemon.currentHp - damage);
                     nextState.log.push(`${targetPokemon.nickname || targetPokemon.speciesName} took ${damage} damage! (${targetPokemon.currentHp}/${targetPokemon.calculatedStats.hp} HP)`);
                } else if (effectivenessMessage && effectivenessMessage.includes("doesn't affect")) {
                     // Logged above
                } else if (move.power && move.power > 0) { // Check move.power exists before comparing
                    nextState.log.push(`It had no effect!`);
                }

                // --- Apply Secondary Effects (including Paralysis) ---
                // Only apply secondary effects if the move hit and wasn't ineffective due to type
                if (effectivenessMessage !== "It doesn't affect the opponent...") {
                    // Example: Apply Paralysis from Thunder Wave (assuming it's status category)
                    if (move.name === '电磁波' /* && move.category === 'Status' */ && targetPokemon.statusCondition === null) {
                         // TODO: Check type immunity (Ground vs Electric)
                        targetPokemon.statusCondition = 'PAR';
                        nextState.log.push(`${targetPokemon.nickname || targetPokemon.speciesName} is paralyzed! It may be unable to move!`);
                    }
                    // Example: Chance of Paralysis from Thunderbolt (assuming 10% chance)
                    else if (move.name === '十万伏特' && targetPokemon.statusCondition === null && Math.random() < 0.1) {
                        // TODO: Check type immunity
                         targetPokemon.statusCondition = 'PAR';
                         nextState.log.push(`${targetPokemon.nickname || targetPokemon.speciesName} was paralyzed!`);
                    }
                    // TODO: Add other status effects (Burn, Poison, Sleep, Freeze)
                    // TODO: Add stat change effects
                }


                // Check if target fainted
                if (targetPokemon.currentHp <= 0) {
                    nextState.log.push(`${targetPokemon.nickname || targetPokemon.speciesName} fainted!`);
                    // TODO: Handle fainting logic
                }
                break; // End of FIGHT case

            // ... (ITEM, SWITCH, RUN cases remain largely the same for now) ...
            case 'ITEM':
                // ... (existing ITEM logic, including catch rate using StatusCatchBonus['PAR']) ...
                 break;
            case 'SWITCH':
                // ... (existing SWITCH logic) ...
                 break;
            case 'RUN':
                // ... (existing RUN logic) ...
                break; // End of RUN case


            default:
                nextState.log.push(`Unknown action type: ${action.type} for ${actor.name}!`);
        }

        // --- Post-Action Checks (Win/Loss) ---
        // ... (existing win/loss checks) ...

         // If the battle ended mid-turn, stop processing further actions
         if (nextState.status !== 'PROCESSING' && nextState.status !== 'WAITING_FOR_INPUT') {
            break;
         }
    } // End of action processing loop

    // ... (End of turn status update and logging) ...

    // --- End of Turn Effects (Poison, Burn damage, etc.) ---
    // Only apply if the battle didn't end mid-turn
    if (nextState.status === 'PROCESSING' || nextState.status === 'WAITING_FOR_INPUT') {
        nextState.log.push(`--- End of Turn ${currentTurnNumber} ---`);
        let battleShouldEnd = false;

        for (const participant of nextState.participants) {
            const pokemon = participant.activePokemon;
            if (pokemon.currentHp > 0) { // Only apply to non-fainted Pokemon
                let faintedFromStatus = false;

                // Poison Damage
                if (pokemon.statusCondition === 'PSN') {
                    const poisonDamage = Math.max(1, Math.floor(pokemon.maxHp / 8)); // 1/8 max HP, min 1
                    pokemon.currentHp = Math.max(0, pokemon.currentHp - poisonDamage);
                    nextState.log.push(`${pokemon.nickname || pokemon.speciesName} was hurt by poison! (-${poisonDamage} HP)`);
                    if (pokemon.currentHp <= 0) {
                         nextState.log.push(`${pokemon.nickname || pokemon.speciesName} fainted!`);
                         faintedFromStatus = true;
                    }
                }
                // TODO: Add Badly Poisoned (TOX) logic (increasing damage)
                
                // Burn Damage
                else if (pokemon.statusCondition === 'BRN') {
                    const burnDamage = Math.max(1, Math.floor(pokemon.maxHp / 16)); // 1/16 max HP, min 1 (Gen VII+)
                    pokemon.currentHp = Math.max(0, pokemon.currentHp - burnDamage);
                    nextState.log.push(`${pokemon.nickname || pokemon.speciesName} was hurt by its burn! (-${burnDamage} HP)`);
                     if (pokemon.currentHp <= 0) {
                         nextState.log.push(`${pokemon.nickname || pokemon.speciesName} fainted!`);
                         faintedFromStatus = true;
                    }
                }
                // TODO: Add other end-of-turn effects (Leech Seed, weather, etc.)

                // Check win/loss again after status damage
                if (faintedFromStatus) {
                    const playerAllFainted = nextState.participants[0].party.every((p: PokemonInstance) => p.currentHp <= 0);
                    const opponentAllFainted = nextState.participants[1].party.every((p: PokemonInstance) => p.currentHp <= 0);

                    if (opponentAllFainted) {
                         nextState.status = 'PLAYER_WIN';
                         nextState.log.push(`${participant.name} was defeated!`);
                         battleShouldEnd = true; break; // Exit loop
                    }
                     if (playerAllFainted) {
                         nextState.status = 'OPPONENT_WIN';
                         nextState.log.push(`${participant.name} was defeated! ${nextState.participants[0].name} is out of usable Pokemon!`);
                         battleShouldEnd = true; break; // Exit loop
                    }
                }
            } // end if hp > 0
        } // end for loop over participants for end-of-turn effects

        // Final status update if battle didn't end from status damage
        if (!battleShouldEnd) {
             if (nextState.status === 'PROCESSING') {
                nextState.status = 'WAITING_FOR_INPUT';
                nextState.log.push("Waiting for next command...");
             }
        }
    } // end if battle didn't end mid-turn

    console.log("End of Turn State:", JSON.stringify(nextState, null, 2));
    return nextState;
} 

// It seems startBattle was missing, defining it here based on previous structure
export async function startBattle(
    playerId: string,
    playerName: string,
    playerParty: PokemonInstance[],
    opponentPokemon: PokemonInstance
): Promise<BattleState> {
    console.log(`Starting battle between ${playerName} and wild ${opponentPokemon.speciesName || "Unknown Pokemon"}`);
    if (!playerParty || playerParty.length === 0) throw new Error("Player has no Pokemon!");
    const playerActivePokemon = playerParty.find((p: PokemonInstance) => p.currentHp > 0); // Add type
    if (!playerActivePokemon) throw new Error("All player Pokemon fainted!");

    const playerParticipant: BattleParticipant = {
        id: playerId, name: playerName, party: playerParty, activePokemon: playerActivePokemon, availableActions: ['FIGHT', 'ITEM', 'SWITCH', 'RUN']
    };
    const opponentParticipant: BattleParticipant = {
        id: opponentPokemon.instanceId, name: `Wild ${opponentPokemon.speciesName || "Unknown Pokemon"}`, party: [opponentPokemon], activePokemon: opponentPokemon, availableActions: ['FIGHT']
    };
    const initialState: BattleState = {
        id: uuidv4(), participants: [playerParticipant, opponentParticipant], turn: 1,
        log: [
            `A wild ${opponentPokemon.speciesName || "Unknown Pokemon"} appeared!`, 
            `${playerName} sent out ${playerActivePokemon.nickname || playerActivePokemon.speciesName || "Pokemon"}!`,
            `What will ${playerName} do?`
        ], 
        status: 'WAITING_FOR_INPUT',
    };
    console.log("Initial Battle State:", initialState);
    return initialState;
}

// Assuming typeUtils.ts exists with TypeChart and getTypeEffectiveness
// If not, these need to be defined within this file or imported correctly.

// Assuming typeUtils.ts exists with TypeChart and getTypeEffectiveness
// If not, these need to be defined within this file or imported correctly. 