/**
 * Represents the basic structure for dialogue options.
 */
interface DialogueOption {
    /** The text the player sees as an option */
    prompt: string;
    /** The NPC's response when this option is chosen */
    response: string;
    /** Optional: Leads to further dialogue state or ends conversation */
    nextState?: string; 
}

/**
 * Represents a simple dialogue structure for an NPC.
 */
interface SimpleDialogue {
    /** Initial greeting when talking to the NPC */
    greeting: string;
    /** Available options after the greeting */
    options?: { [keyword: string]: DialogueOption | string }; // Keyword triggers the option or simple string response
    /** Default response if player says something unrecognized */
    defaultResponse?: string;
    /** Message upon ending conversation */
    farewell?: string;
    // TODO: Expand later for more complex dialogue trees (states, conditions)
}

/**
 * Represents a Non-Player Character (NPC) in the game.
 */
export interface NPC {
    /** Unique identifier for the NPC */
    id: string;
    /** NPC's name */
    name: string;
    /** Description shown when the player looks at the NPC */
    description: string;
    /** The ID of the location where the NPC initially spawns */
    initialLocationId: string; 
    /** Path to the detailed AI prompt configuration file */
    promptFile: string;
    /** The loaded AI prompt configuration object */
    aiPromptConfig: any;
    /** Optional: Other flags or data associated with the NPC */
    flags?: { [key: string]: any };
    // TODO: Add fields for AI-driven behavior if needed
} 