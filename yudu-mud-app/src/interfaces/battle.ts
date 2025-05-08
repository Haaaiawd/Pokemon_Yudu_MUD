import { PokemonInstance } from './pokemon';
import { Item } from '@/lib/gameData'; // Import Item from gameData

// Define the types of actions a participant can take in a battle turn
export type BattleActionType = 'FIGHT' | 'ITEM' | 'SWITCH' | 'RUN';

// Represents an action taken by a participant
export interface BattleAction {
    type: BattleActionType;
    // For FIGHT action: The move ID/name being used
    moveId?: string;
    // For ITEM action: The item ID being used and potentially the target Pokemon index in the party
    itemId?: string;
    targetPokemonIndex?: number; // e.g., using a Potion on a benched Pokemon
    // For SWITCH action: The index of the Pokemon being switched in from the party
    switchToPokemonIndex?: number;
    // For RUN action: No additional data needed initially
}

// Represents a single participant (player or opponent) in the battle
export interface BattleParticipant {
    id: string; // Could be player ID or a unique ID for the opponent trainer/wild Pokemon
    name: string;
    activePokemon: PokemonInstance; // The Pokemon currently fighting
    party: PokemonInstance[]; // Full team, including the active one
    availableActions: BattleActionType[]; // What actions are currently allowed
    // Potentially add trainer items if implementing trainer battles
    items?: Item[];
}

// Represents the overall state of a battle
export interface BattleState {
    id: string; // Unique ID for this battle instance
    participants: BattleParticipant[]; // Usually two participants: player and opponent
    turn: number; // Current turn number
    weather?: string; // Optional: Current weather condition
    fieldEffects?: string[]; // Optional: Any active field effects (e.g., Stealth Rock)
    log: string[]; // Log of battle events for display
    status: 'INITIALIZING' | 'WAITING_FOR_INPUT' | 'PROCESSING' | 'PLAYER_WIN' | 'OPPONENT_WIN' | 'DRAW' | 'FLED'; // Current status of the battle
    // Add any other relevant battle-wide state
} 