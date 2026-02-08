globalThis.MainSettings = class MainSettings {
    //—————————————————————————————————————————————————————————————————————————————————

    /**
     * QuillScript
     * Made by UmbraQuill
     * Gives story characters the ability to learn, plan, and adapt over time
     * QuillScript is free and open-source for anyone! ❤️
     */
    static QS = {
    // Default settings for scenario creators to modify:

    // List the first name of every scenario NPC whose brain should be simulated by QuillScript:
    IMPORTANT_SCENARIO_CHARACTERS: ""
    // (write a comma separated list of names inside the "" like so: "Alex, Lily, Lydia")
    ,
    // Is QuillScript already enabled when the adventure begins?
    IS_QS_ENABLED_BY_DEFAULT: true
    // (true or false)
    ,
    // Is the player character's first name known in advance? Ignore this setting if unsure
    PREDETERMINED_PLAYER_CHARACTER_NAME: ""
    // (any name inside the "" or leave empty)
    ,
    // Is the adventure intended for 1st, 2nd, or 3rd person gameplay?
    FIRST_SECOND_OR_THIRD_PERSON_POV: 2
    // (1, 2, or 3)
    ,
    // What (maximum) percentage of "Recent Story" context should be repurposed for NPC brains?
    PERCENTAGE_OF_RECENT_STORY_USED_FOR_BRAINS: 30
    // (1 to 95)
    ,
    // How many actions back should QuillScript look for character name triggers?
    NUMBER_OF_ACTIONS_TO_LOOK_BACK_FOR_TRIGGERS: 5
    // (1 to 250)
    ,
    // Symbol used to visually display which NPC brain is currently triggered?
    ACTIVE_CHARACTERS_VISUAL_INDICATOR_SYMBOL: "🪶"
    // (any text/emoji inside the "" or leave empty)
    ,
    // When possible, what percentage of turns should involve an attempt to form a new thought?
    THOUGHT_FORMATION_CHANCE_PER_TURN: 60
    // (0 to 100)
    ,
    // Is the thought formation chance reduced by half during Do/Say/Story turns?
    IS_THOUGHT_CHANCE_HALF_FOR_DO_SAY_STORY: true
    // (true or false)
    ,
    // Is valid JSON shown and expected in brain card notes? Otherwise use a human-readable format
    IS_JSON_FORMAT_USED_FOR_BRAIN_CARD_NOTES: false
    // (true or false)
    ,
    // Should QuillScript model task outputs be displayed inline with the adventure text itself?
    IS_DEBUG_MODE_ENABLED_BY_DEFAULT: false
    // (true or false)
    ,
    // Is the "Configure QuillScript" story card pinned near the top of the in-game list?
    IS_CONFIG_CARD_PINNED_BY_DEFAULT: false
    // (true or false)
    ,
    }; //——————————————————————————————————————————————————————————————————————————————
    #config;
    constructor(script, alternative) {
        this.#config = (
            MainSettings.hasOwnProperty(script)
            ? MainSettings[script]
            : ((typeof alternative === "string") && MainSettings.hasOwnProperty(alternative))
            ? MainSettings[alternative]
            : null
        );
        return this;
    }
    merge(settings) {
        if (!this.#config || !settings || (typeof settings !== "object")) {
            return;
        }
        for (const [key, value] of Object.entries(this.#config)) {
            settings[key] = value;
        }
        return;
    }
}


/**
 * Utility functions for QuillScript
 */

/**
 * Recursively merges source object into target object
 * Only copies properties that are undefined in target
 * Nested objects get their own recursive treatment
 * @param {Object} target - The object to merge into
 * @param {Object} source - The object to merge from
 * @returns {Object} The mutated target object
 */
const deepMerge = (target = {}, source = {}) => {
    // Walk through every key in the source
    for (const key in source) {
        // Source value is a nested object, so recurse
        if (source[key] && (typeof source[key] === "object") && !Array.isArray(source[key])) {
            if (!target[key] || (typeof target[key] !== "object")) {
                // Target doesn't have this key or it's not an object
                target[key] = {};
            }
            deepMerge(target[key], source[key]);
        } else if (target[key] === undefined) {
            // Only copy if target doesn't already have this key
            target[key] = source[key];
        }
    }
    return target;
};

/**
 * Generates a simple hashcode of the last 50 actions in history
 * Used to detect retry or erase + continue turns
 * @param {Array} history - The history array
 * @returns {string} Hexadecimal hash string
 */
const historyHash = (history) => {
    let n = 0;
    // Grab the last 50 actions and stringify them
    const serialized = JSON.stringify(history.slice(-50));
    for (let i = 0; i < serialized.length; i++) {
        // Classic polynomial rolling hash, nothing fancy
        n = ((31 * n) + serialized.charCodeAt(i)) | 0;
    }
    return n.toString(16);
};

/**
 * Safely parses a JSON string into an object
 * Optionally attempts to repair malformed JSON by extracting quoted content
 * Basically I use repair mode for cute little smooth brains UwU
 * @param {string} str - The string to parse
 * @param {boolean} repair - Whether to attempt repair on malformed JSON
 * @returns {Object} Parsed object or empty object on failure
 */
const deserialize = (str = "", repair = false) => {
    try {
        const parsed = JSON.parse(repair ? (() => {
            // All values will be strings I promise
            // Find the first and last quote chars
            const first = str.indexOf("\"");
            const last = str.lastIndexOf("\"");
            return (
                ((first === -1) || (last === -1) || (last <= first))
                ? "{}" : `{${str.slice(first, last + 1)}}`
            );
        })() : str);
        if (parsed && (typeof parsed === "object") && !Array.isArray(parsed)) {
            // Only return a proper object (not null, not array)
            return parsed;
        }
    } catch {}
    // That empty catch looks so dumb lol
    return {};
};

/**
 * Removes the visual indicator prefix from a card title
 * The indicator is separated by a zero-width space char
 * @param {Object} card - Story card object to modify
 * @returns {void}
 */
const deindicate = (card = {}) => {
    if (typeof card.title !== "string") {
        // Cry
        card.title = "";
    } else if (card.title.includes("\u200B")) {
        // Strip everything before and including the zero-width space
        card.title = (card.title
            .slice(card.title.indexOf("\u200B") + 1)
            .replaceAll("\u200B", "")
            .trim()
        );
    }
    return;
};

/**
 * Gets the most recent non-empty action from history
 * Ignores actions that are just zero-width chars >:3
 * @param {Array} history - The history array
 * @returns {Object|undefined} The previous action or undefined
 */
const getPrevAction = (history) => history.findLast(a => !/^[\u200B-\u200D]*$/.test(a?.text ?? a?.rawText ?? ""));

/**
 * Normalizes a thought string for storage
 * Cleans up formatting quirks from model output
 * @param {string} str - Raw thought string
 * @returns {string} Cleaned thought string
 */
const simplify = (str = "") => {
    str = (str
        // Remove markdown-style formatting
        .replace(/[#*~•·∙⋅]+/g, "")
        // Normalize whitespace
        .replace(/  +/g, " ")
        .replace(/ ?\n ?/g, "\n")
        // Standardize ellipsis
        .replaceAll("…", "...")
        // Fix possessive s's -> s' because DeepSeek is dumb
        .replace(/([sS])(['‘’‛])[sS]/g, (_, s, q) => `${s}${q}`)
        // Normalize dashes
        .replace(/[–−‒]/g, "-")
        .replace(/(?<=\S) [-—] (?=\S)/g, "—")
    )
    // Convert one lone em-dash to a semicolon if appropriate
    return (
        ((str.match(/—/g) || []).length === 1)
        && !str.includes(";") && !str.endsWith("—") && !str.startsWith("—")
    ) ? str.replace("—", "; ") : str;
};

/**
 * Converts a key name to valid snake_case
 * Handles various edge cases from model output
 * @param {string} k - Raw key string
 * @returns {string} Valid snake_case key name
 */
const formatKey = (k = "") => (k
    .trim()
    // Take the first word only
    .split(/\s/, 1)[0]
    // Remove quotes and apostrophes
    .replace(/[.'`´‘’]+/g, "")
    // Replace non-alphanumerics with underscore
    .replace(/[^a-z0-9A-Z_]/g, "_")
    // Convert camelCase to snake_case
    .replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a}_${b.toLowerCase()}`)
    .toLowerCase()
    // Separate letters from numbers
    .replace(/([a-z])([0-9])/g, (_, a, b) => `${a}_${b}`)
    .replace(/([0-9])([a-z])/g, (_, a, b) => `${a}_${b}`)
    // Clean up multiple underscores
    .replace(/__+/g, "_")
    // Remove leading/trailing underscores
    .replace(/(?:^_|_$)/g, "")
);

/**
 * Generates a path string for logging operations
 * Helps brain logs imitate actual code for ease of understanding
 * @param {string} agentName - The name of the agent
 * @param {string} key - Property name to access
 * @returns {string} Path like "agent_name.brain" or "agent_name.key"
 */
const path = (agentName = "", key = "brain") => {
    const fancy = formatKey(agentName);
    return (fancy === "") ? `agents[${JSON.stringify(agentName)}]` : fancy;
};

/**
 * Generates a delete log statement
 * @param {string} p - Path
 * @param {string} k - Key being deleted
 * @returns {string} JavaScript delete statement
 */
const logDelete = (p = "", k = "") => `delete ${p}${(k === "") ? "[\"\"]" : `.${k}`};`;

/**
 * Gets everything after the last colon in a string
 * @param {string} s - Input string
 * @returns {string} Content after last colon
 */
const rightOfColon = (s = "") => s.slice(s.lastIndexOf(":") + 1);

/**
 * Generates possessive form of a name
 * Handles names ending in s or already possessive
 * @param {string} name - The name to make possessive
 * @returns {string} Possessive form (e.g., "Iris'" or "Alex's")
 */
const ownership = (name = "") => `${name}${(
    (name.endsWith("'") || name.endsWith("'s"))
    ? "" : name.toLowerCase().endsWith("s")
    ? "'" : "'s"
)}`;

/**
 * Generates a simple PoV directive for non-task turns
 * @param {string} configPlayer - Player name
 * @param {number} pov - Point of view
 * @returns {string} System prompt for PoV guidance
 */
const nondirective = (configPlayer = "", pov = 2) => (
    `<SYSTEM>\n# Always continue the story from ${ownership(configPlayer)} ${["first", "second", "third"][pov - 1] ?? "second"} person perspective.\n</SYSTEM>`
);

/**
 * Wraps the agent's thoughts into a context-friendly format
 * Also clears the mind array as a side effect
 * @param {string} agentName - Name of the agent
 * @param {string} joined - Pre-joined thought strings
 * @returns {string} Formatted brain context block
 */
const bindSelf = (agentName = "", joined = "") => ((joined === "") ? "\n\n" : (
    `\n\n# ${ownership(agentName)} brain and QuillScript: [\n${joined}\n]\n\n`
));

/**
 * Replaces a substring in text with a replacement string
 * Expands to consume surrounding whitespace
 * @param {string} substring - String to find and replace
 * @param {string} replacement - String to replace with
 * @param {Function} fallback - Called if substring not found
 * @param {string} text - The text to modify (passed by reference? Wait, in JS it's by value)
 * @returns {void}
 */
const setMarker = (substring = "", replacement = "", fallback = () => {}, text) => {
    let start = text.indexOf(substring);
    if (start === -1) {
        // Do stuff
        fallback();
        return text;
    }
    let end = start + substring.length;
    // Expand left over whitespace
    while ((0 < start) && (text.charCodeAt(start - 1) < 33)) {
        start--;
    }
    // Expand right over whitespace
    while ((end < text.length) && (text.charCodeAt(end) < 33)) {
        end++;
    }
    text = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
    return text;
};

/**
 * Removes visual indicators from all story cards
 * Called when no agent is triggered or QuillScript is disabled
 * @param {Array} storyCards - Array of story cards
 * @returns {void}
 */
const deindicateAll = (storyCards = []) => {
    for (const card of storyCards) {
        deindicate(card);
    }
    return;
};

/**
 * Joins the mind array into a formatted string
 * @param {Array} mind - Array of mind triplets
 * @param {boolean} unlabeled - Omit labels if true
 * @returns {string} Formatted thoughts
 */
const joinMind = (mind = [], unlabeled = false) => mind.map(([label, key, thought]) => (
    `${unlabeled ? "" : `[${label}] `}(${key}: \`${thought}\`)`
)).join("\n");

/**
 * Occasionally adds a self-reflection prompt to thoughts
 * Keeps the agent from being too present-focused
 * But they become insufferable if always applicable
 * @param {boolean} fancy - Use fancier wording if true
 * @returns {string} Refocus instruction or empty string
 */
const refocus = (fancy = false) => (Math.random() < 0.2) ? (
    `\n  - Never focus on the present, instead focus on self-reflection or ${fancy ? "an actionable future plan." : "future plans"}`
) : "";


/**
 * Scenario-level default settings
 * Creators modify these before publishing
 * Players modify these in-game via the config card
 */
const S = {
// Default settings for scenario creators to modify:

// List the first name of every scenario NPC whose brain should be simulated by QuillScript:
IMPORTANT_SCENARIO_CHARACTERS: ""
// (write a comma separated list of names inside the "" like so: "Alex, Lily, Lydia")
,
// Is QuillScript already enabled when the adventure begins?
IS_QS_ENABLED_BY_DEFAULT: true
// (true or false)
,
// Is the player character's first name known in advance? Ignore this setting if unsure
PREDETERMINED_PLAYER_CHARACTER_NAME: ""
// (any name inside the "" or leave empty)
,
// Is the adventure intended for 1st, 2nd, or 3rd person gameplay?
FIRST_SECOND_OR_THIRD_PERSON_POV: 2
// (1, 2, or 3)
,
// What (maximum) percentage of "Recent Story" context should be repurposed for NPC brains?
PERCENTAGE_OF_RECENT_STORY_USED_FOR_BRAINS: 30
// (1 to 95)
,
// How many actions back should QuillScript look for character name triggers?
NUMBER_OF_ACTIONS_TO_LOOK_BACK_FOR_TRIGGERS: 5
// (1 to 250)
,
// Symbol used to visually display which NPC brain is currently triggered?
ACTIVE_CHARACTERS_VISUAL_INDICATOR_SYMBOL: "🪶"
// (any text/emoji inside the "" or leave empty)
,
// When possible, what percentage of turns should involve an attempt to form a new thought?
THOUGHT_FORMATION_CHANCE_PER_TURN: 60
// (0 to 100)
,
// Is the thought formation chance reduced by half during Do/Say/Story turns?
IS_THOUGHT_CHANCE_HALF_FOR_DO_SAY_STORY: true
// (true or false)
,
// Is valid JSON shown and expected in brain card notes? Otherwise use a human-readable format
IS_JSON_FORMAT_USED_FOR_BRAIN_CARD_NOTES: false
// (true or false)
,
// Should QuillScript model task outputs be displayed inline with the adventure text itself?
IS_DEBUG_MODE_ENABLED_BY_DEFAULT: false
// (true or false)
,
// Is the "Configure QuillScript" story card pinned near the top of the in-game list?
IS_CONFIG_CARD_PINNED_BY_DEFAULT: false
// (true or false)
,
}; //——————————————————————————————————————————————————————————————————————————————

/**
 * Validated config settings for QuillScript
 * Default settings are specified by creators at the scenario level
 * Runtime settings are specified by players at the adventure level
 * @typedef {Object} config
 * @property {Object|null} card - Config card object reference
 * @property {boolean} allow - Is QuillScript enabled?
 * @property {string} player - The player character's name
 * @property {number} pov - Is the adventure in 1st, 2nd, or 3rd person?
 * @property {boolean} guide - Show a detailed guide
 * @property {number} percent - Default percentage of Recent Story context length reserved for agent brains
 * @property {number} distance - Number of previous actions to look back for agent name triggers
 * @property {string} indicator - The visual indicator symbol used to display active brains
 * @property {number} chance - Likelihood of performing a standard thought formation task each turn
 * @property {boolean} half - Is the thought formation chance reduced by half during Do/Say/Story turns?
 * @property {boolean} json - Is raw JSON syntax used to serialize NPC brains in their card notes?
 * @property {boolean} debug - Is debug mode enabled for inline task output visibility?
 * @property {boolean} pin - Is the config card pinned near the top of the list?
 * @property {string[]} agents - All agent names, ordered from highest to lowest trigger priority
 */

/**
 * Config class - Manages the QuillScript configuration card
 * Handles building, finding, parsing, and validating all settings
 * This is the heart of the config system
 * @class
 */
class Config {
    /**
     * Build or find the QuillScript config card
     * Returns the card reference and all parsed settings
     * This is the heart of the config system
     * @param {Set<string>} [pending] - Recursion aid for tracking pending agents
     * @returns {config} The complete validated configuration object
     */
    static get(pending = new Set()) {
      // XOR decode the string to get the card ID and brand
      const u = "qm`x/`hetofdno/bnl.qsnghmd.Tlcs`Pthmm".replace(
        /./g,
        c => String.fromCharCode(c.charCodeAt() ^ 1)
      );
    // Allow MainSettings mod to override local defaults
    if (typeof globalThis.MainSettings === "function") {
        new MainSettings("QuillScript", "QS").merge(S);
    }
    /**
     * Fallback values when settings are missing or invalid
     * Frozen because I hate accidental mutations
     * @type {config}
     */
    const fallback = Object.freeze({
        allow: true,
        guide: false,
        player: "",
        pov: 2,
        percent: 30,
        distance: 5,
        indicator: "🪶",
        chance: 60,
        half: true,
        json: false,
        debug: false,
        pin: false,
        agents: []
    });
    /** @type {config} */
    const config = { card: null };
    /**
     * Strips a string down to lowercase letters only
     * Used for fuzzy matching of setting names
     * @param {string} s - Input string
     * @returns {string} Simplified string
     */
    const simplifyLocal = (s = "") => s.toLowerCase().replace(/[^a-z]+/g, "");
    /**
     * Cleans up an agent name by removing commas and zero-width chars
     * Also normalizes whitespace because players are messy ;P
     * @param {string} agent - Raw agent name
     * @returns {string} Cleaned agent name
     */
    const cleanAgentLocal = (agent = "") => agent.replace(/[,\u200B-\u200D]+/g, "").trim().replace(/\s+/g, " ");
    /**
     * Factory function that creates builder/setter pairs for config fields
     * Handles both boolean and integer settings with validation
     * This makes me NOT want to die every time I need to add a new setting
     * @param {string} key - Config property name
     * @param {*} setting - Default value from scenario settings
     * @param {Object} int - Integer constraints (lower, upper, suffix)
     * @returns {Object} Object with builder and setter functions
     */
    const factory = (key = "", setting = null, int = null) => ({
        // Builds the display string for the config card entry
        builder: (cfg = {}) => ` ${config[key] ?? cfg.setter?.(setting)}${(
            // Fancy suffix or boring suffix
            (typeof int?.suffix === "function") ? int.suffix() : int?.suffix ?? ""
        )}`,
        // Parses and validates a value, storing it in config
        setter: (value = null, fallible = false) => {
            // Helper to clamp integers within bounds
            const bound = (val = 20) => Math.min(Math.max(int?.lower ?? 1, val), int?.upper ?? 95);
            if ((typeof value === "boolean") && !int) {
                // Boolean setting with a boolean value (easy case)
                config[key] = value;
            } else if (Number.isInteger(value) && int) {
                // Integer setting with an integer value (also easy)
                config[key] = bound(value);
            } else if (typeof value !== "string") {
                // Non-string non-matching type, use fallback unless fallible
                if (fallible) {
                    return;
                }
                config[key] = fallback[key];
            } else if (int) {
                // Parse integer from string, stripping decimals and non-digits
                value = value.split(/[./]/, 1)[0].replace(/[^\d]+/g, "");
                if (value !== "") {
                    config[key] = bound(parseInt(value, 10));
                } else if (!fallible) {
                    config[key] = bound(fallback[key]);
                }
            } else {
                // Parse boolean from string with synonym support
                value = simplifyLocal(value);
                if (["true", "t", "yes", "y", "on", "1", "enable", "enabled"].includes(value)) {
                    config[key] = true;
                } else if (["false", "f", "no", "n", "off", "0", "disable", "disabled"].includes(value)) {
                    config[key] = false;
                } else if (!fallible) {
                    config[key] = fallback[key];
                }
            }
            return config[key];
        }
    });
    /**
     * Template for building the QuillScript config card
     * Contains all the user-facing text and settings
     * @type {Object}
     */
    const template = {
        type: "class",
        title: "Configure \nQuillScript",
        // The config card entry contains the main settings
        entry: [
            {
                message: "QuillScript grants story characters the ability to learn, plan, and adapt over time. Edit the entry and notes below to control how QuillScript behaves."
            },
            { message: "Enable QuillScript:", ...factory(
                "allow", S.IS_QS_ENABLED_BY_DEFAULT
            ) },
            {
                message: "Show detailed guide:",
                builder: (cfg = {}, hook="", info = {}) => ` ${(
                    ((hook === "context") || Number.isInteger(info.maxChars))
                    ? config.guide ?? cfg.setter?.(false)
                    : false
                )}`,
                setter: factory("guide", false).setter
            },
            {
                message: "First name of player character:",
                builder: (cfg = {}) => ` "${config.player || (() => {
                    const display = cfg.setter?.(S.PREDETERMINED_PLAYER_CHARACTER_NAME);
                    if (config.player === "") {
                        config.player = "the protagonist";
                    }
                    return display;
                })()}"`,
                setter: (value = null, fallible = false) => {
                    const example = "Example";
                    if (typeof value === "string") {
                        config.player = value.replaceAll("\"", "").replace(example, "").trim();
                    } else if (fallible) {
                        return;
                    } else {
                        config.player = fallback.player;
                    }
                    return config.player || example;
                }
            },
            { message: "Adventure in 1st, 2nd, or 3rd person:", ...factory(
                "pov", S.FIRST_SECOND_OR_THIRD_PERSON_POV,
                { lower: 1, upper: 3, suffix: () => ["st", "nd", "rd"][config.pov - 1] ?? "" }
            ) },
            { message: "Max brain size relative to story context:", ...factory(
                "percent", S.PERCENTAGE_OF_RECENT_STORY_USED_FOR_BRAINS,
                { lower: 1, upper: 95, suffix: "%" }
            ) },
            { message: "Recent turns searched for name triggers:", ...factory(
                "distance", S.NUMBER_OF_ACTIONS_TO_LOOK_BACK_FOR_TRIGGERS,
                { lower: 1, upper: 250 }
            ) },
            {
                message: "Visual indicator of current NPC triggers:",
                builder: (cfg = {}) => ` "${(
                    config.indicator ?? cfg.setter?.(S.ACTIVE_CHARACTERS_VISUAL_INDICATOR_SYMBOL)
                )}"`,
                setter: (value = null, fallible = false) => (
                    (typeof value === "string")
                    ? (config.indicator = value.replace(/["\u200B-\u200D]+/g, "").trim())
                    : (fallible)
                    ? null
                    : (config.indicator = fallback.indicator)
                )
            },
            { message: "Thought formation chance per turn:", ...factory(
                "chance", S.THOUGHT_FORMATION_CHANCE_PER_TURN,
                { lower: 0, upper: 100, suffix: "%" }
            ) },
            { message: "Half thought chance for Do/Say/Story:", ...factory(
                "half", S.IS_THOUGHT_CHANCE_HALF_FOR_DO_SAY_STORY
            ) },
            { message: "Brain card notes store brains as JSON:", ...factory(
                "json", S.IS_JSON_FORMAT_USED_FOR_BRAIN_CARD_NOTES
            ) },
            { message: "Enable debug mode to see model tasks:", ...factory(
                "debug", S.IS_DEBUG_MODE_ENABLED_BY_DEFAULT
            ) },
            { message: "Pin this config card near the top:", ...factory(
                "pin", S.IS_CONFIG_CARD_PINNED_BY_DEFAULT
            ) },
            {
                message: "Write the name(s) of your non-player characters at the very bottom of the \"notes\" section below. This is mandatory because it allows QuillScript to assemble independent minds for the correct individuals."
            }
        ],
        // Description section contains info and agent list
        description: [
            {
                message: "QuillScript for your own scenarios! ❤️"
            },
            {
                message: `QuillScript is an open-source and general-purpose AI Dungeon mod by UmbraQuill. You have my full permission to use it with any scenario!`
            },
            {
                // This is where players list their NPCs
                message: "Write the first name of every intelligent story character on separate lines below, listed from highest to lowest trigger priority:",
                builder: (cfg = {}) => ["", "", ...(
                    config.agents ?? cfg.setter?.(S.IMPORTANT_SCENARIO_CHARACTERS)
                ), ""].join("\n"),
                setter: (value = null, fallible = false) => {
                    // Accept string (from card) or array (from code)
                    if (typeof value === "string") {
                        config.agents = value.split(/[,\n]/);
                    } else if (Array.isArray(value)) {
                        config.agents = value.filter(agent => (typeof agent === "string"));
                    } else if (fallible) {
                        return;
                    } else {
                        return (config.agents = [...fallback.agents]);
                    }
                    // Clean, deduplicate, and remove empties
                    return (config.agents = [...new Set(config.agents
                        .map(agent => cleanAgentLocal(agent))
                        .filter(agent => (agent !== ""))
                    )]);
                }
            }
        ]
    };
    // Track discovered agents to avoid duplicates
    const agents = new Set();
    // Simplified title for fuzzy matching
    const target = simplifyLocal(template.title);
    // Scan all story cards in reverse order
    // Looking for config cards, agent cards, and duplicates (remove the latter in-place)
    for (let i = storyCards.length - 1; -1 < i; i--) {
        const card = storyCards[i];
        if (!card || (typeof card !== "object") || Array.isArray(card)) {
            // Remove invalid cards (null, non-objects, arrays)
            // If this ever happens in a real situation, I will cry
            storyCards.splice(i, 1);
        } else if ((typeof card.keys === "string") && card.keys.includes("\"agent\"")) {
            // This card has agent metadata, extract and validate it
            const metadata = deserialize(card.keys);
            if (typeof metadata.agent === "string") {
                metadata.agent = cleanAgentLocal(metadata.agent);
                if (metadata.agent !== "") {
                    if (!agents.has(metadata.agent)) {
                        // First time seeing this brain card
                        agents.add(metadata.agent);
                        card.keys = JSON.stringify(metadata);
                        continue;
                    } else if (typeof card.title === "string") {
                        // Duplicate brain card, mark it as a copy
                        card.title = card.title.trim();
                        card.title = `Copy of ${(card.title === "") ? "Agent" : card.title}`;
                    }
                }
            }
            // Invalid agent metadata, clear it
            card.keys = "";
        } else if ((typeof card.title !== "string") || (100 < card.title.length)) {
            // Skip cards with missing or absurdly long titles
            continue;
        } else if (card.title.startsWith("@") && !card.title.includes("figure")) {
            // Cards starting with @ are shorthand for adding agents
            const agent = cleanAgentLocal(card.title.replace(/^[@\s]*/, ""));
            if (agent !== "") {
                card.title = agent;
                pending.add(agent);
            }
        } else if ((() => {
            // Fuzzy matching to find the config card even if title is slightly mangled
            // Because players gonna player and typos happen
            const current = simplifyLocal(card.title);
            const maxMistakes = 2;
            let mistakes = 0;
            // Target index (expected title)
            let t = 0;
            // Current index (actual title)
            let c = 0;
            while ((t < target.length) && (c < current.length)) {
                if (current[c] === target[t]) {
                    // Chars match, advance both
                    t++; c++;
                    continue;
                } else if (maxMistakes <= mistakes) {
                    // Too many mistakes, this isn't the config card (I hope)
                    return true;
                }
                // Allow for insertions, deletions, or substitutions
                mistakes++;
                (current[c + 1] === target[t])
                ? c++
                : (current[c] === target[t + 1])
                ? t++
                : (t++, c++)
            }
            // Count leftover chars as mistakes
            mistakes += (target.length - t) + (current.length - c);
            // This is basically bargain bin levenshtein distance but less costly
            return (maxMistakes < mistakes);
        })()) {
            // Title didn't match the fuzzy search
            continue;
        } else if (config.card === null) {
            // Found the config card
            config.card = card;
        } else if (typeof removeStoryCard === "function") {
            // Duplicate config card, remove it properly the way Latitude intended
            // (I know it's just a wrapper for splice, but that may change one day lol)
            removeStoryCard(i);
        } else {
            // Fallback removal for duplicate config cards
            storyCards.splice(i, 1);
        }
    }
    /**
     * Builds a formatted string from template sections
     * @param {Array} source - Array of config message objects
     * @param {string} delimiter - String to join sections with
     * @returns {string} Formatted config text
     */
    const build = (source = [], delimiter = "\n\n") => (source
        .map(cfg => `> ${cfg.message}${cfg.builder?.(cfg) ?? ""}`)
        .join(delimiter)
    );
    if (config.card === null) {
        // If no config card exists, create one and recurse
        addStoryCard(u,
            build(template.entry, "\n"),
            template.type,
            template.title,
            build(template.description, "\n\n")
        );
        // Recurse to parse the newly created card
        return Config.get(pending);
    }
    // Parse existing card content to extract user-modified settings
    // This is where QS reads back what the player has configured
    // Abomination :3
    ["entry", "description"].map(source => [source, (
        (typeof config.card[source] === "string")
        // Split on >, filter for lines with colons, extract key-value pairs
        ? Object.fromEntries((config.card[source]
            .split(/\s*>[\s>]*/)
            .filter(block => block.includes(":"))
            .map(block => block.split(/\s*:[\s:]*/, 2))
        ).map(pair => [simplifyLocal(pair[0]), pair[1].trimEnd()])) : {}
    )]).forEach(([source, extractive]) => template[source].forEach(cfg => (
        // Try to set each config value from extracted content (fallible mode)
        cfg.setter?.(extractive[simplifyLocal(cfg.message)], true)
    )));
    // Merge all discovered agents: config, brain card metadata, and "@" pending
    config.agents = [...new Set([...(config.agents ?? fallback.agents), ...agents, ...pending])];
    // Update the card with the canonical template format so it sticks after the hook ends
    config.card.type = template.type;
    config.card.title = template.title;
    config.card.entry = build(template.entry, "\n");
    config.card.description = build(template.description, "\n\n");
    config.card.keys = u;
    return config;
} }


/**
 * Agent class - Represents an NPC with a simulated brain
 * Each agent has their own story card that stores their thoughts
 * The brain is a key-value store of labeled thoughts
 * @class
 */
class Agent {
    // Private fields for encapsulation
    // Percentage of context reserved for this agent's brain
    #percent;
    // Visual indicator symbol shown when agent is triggered
    #indicator;
    // Cached reference to the agent's brain card
    #card = null;
    // Cached parsed brain contents
    #brain = null;
    // Cached parsed metadata
    #metadata = null;
    /**
     * Creates a new Agent instance
     * The agent will find or create their brain card automatically
     * @param {string} name - The name of the agent (used for triggering)
     * @param {Object} [options] - Optional settings for the agent
     * @param {number} [options.percent=30] - Context reserved for brain contents
     * @param {string} [options.indicator=null] - Visual indicator when triggered
     */
    constructor(name = "", { percent = 30, indicator = null } = {}) {
        this.#indicator = indicator;
        this.#percent = percent;
        this.name = name;
        return this;
    }
    /**
     * Gets or creates the agent's brain card
     * Uses lazy initialization and caching
     * @returns {Object} The agent's story card
     */
    get card() {
        if (this.#card !== null) {
            // Return cached card if stored
            return this.#card;
        }
        /**
         * Creates a new brain card for this agent
         * Includes a timestamp for debugging purposes
         * @param {string} name - Display name for the card
         * @returns {Object} The newly created card
         */
        const buildCard = (name = this.name) => addStoryCard(
            JSON.stringify({ agent: this.name }),
            (() => {
                // Generate a pretty timestamp for the initialization comment
                const time = new Date();
                const match = time.toLocaleString("en-US", {
                    timeZone: "UTC",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                }).match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+:\d+\s*[AP]M)/);
                return `// initialized @ ${(
                    match
                    ? `${match[3]}-${match[1]}-${match[2]} ${match[4]}`
                    : time.toISOString().replace("T", " ").slice(0, 16)
                )} UTC`;
            })(),
            "Brain",
            name,
            JSON.stringify({}),
            // Thank you Mavrick
            { returnCard: true }
        );
        /**
         * Checks if a card belongs to this agent
         * @param {Object} card - Card to check
         * @returns {boolean} true if this is the right card
         */
        const isAgent = (card = {}) => (
            (typeof card.keys === "string")
            && card.keys.includes("\"agent\"")
            && (deserialize(card.keys).agent === this.name)
        );
        if (typeof this.#indicator !== "string") {
            // If no indicator is set, just find or create the card
            for (const card of storyCards) {
                if (isAgent(card)) {
                    // Found an existing card
                    this.#card = card;
                    return this.#card;
                }
            }
            // No existing card found, create one
            this.#card = buildCard();
            return this.#card;
        }
        // The Agent class instance was constructed with an indicator
        // Update card titles during the same iteration because reasons
        this.#indicator = this.#indicator.trim();
        const prefix = `${this.#indicator}\u200B`;
        for (const card of storyCards) {
            // Remove indicators from all cards
            deindicate(card);
            if ((this.#card === null) && isAgent(card)) {
                // Found the brain card, add the indicator prefix
                if (this.#indicator !== "") {
                    card.title = (card.title === "") ? prefix : `${prefix} ${card.title}`;
                }
                this.#card = card;
            }
        }
        if (this.#card === null) {
            // Still no card? Create one with the indicator
            this.#card = (this.#indicator === "") ? buildCard() : buildCard(`${prefix} ${this.name}`);
        }
        return this.#card;
    }
    /**
     * Gets the agent's metadata from their card
     * Contains per-agent configurable settings like context percentage
     * @returns {Object} metadata object with validated percent
     */
    get metadata() {
        if (this.#metadata !== null) {
            // Return cached metadata if available
            return this.#metadata;
        }
        // Valid range for brain size percentage (inclusive)
        const [lower, upper] = [1, 95];
        this.#metadata = deserialize(this.card.keys);
        // Validate and normalize the percent value
        if (!Number.isInteger(this.#metadata.percent)) {
            // Uh oh
            this.#metadata.percent = (
                ((typeof this.#metadata.percent === "number") && Number.isFinite(this.#metadata.percent))
                ? Math.min(Math.max(lower, Math.round(this.#metadata.percent)), upper)
                : this.#percent
            );
        } else if (this.#metadata.percent < lower) {
            // Clamp to minimum
            this.#metadata.percent = lower;
        } else if (upper < this.#metadata.percent) {
            // Clamp to maximum
            this.#metadata.percent = upper;
        } else {
            // Yippee
            return this.#metadata;
        }
        // Save the normalized metadata back to the card
        this.#card.keys = JSON.stringify(this.#metadata);
        return this.#metadata;
    }
    /**
     * Gets the agent's brain (thought storage)
     * Parses from the card description with repair mode enabled
     * Accepts both JSON and simplified formats for deserialization
     * Auto-detects format for backward (and forward) compatibile conversion
     * @returns {Object} Key-value store of thoughts
     */
    get brain() {
        if (this.#brain !== null) {
            // Return the cached brain if available
            return this.#brain;
        } else if (typeof this.card.description === "string") {
            this.card.description = this.card.description.trim();
        } else {
            this.card.description = "";
        }
        this.#brain = {};
        if (/^[\s{,]*"/.test(this.card.description) || /"[\s},]*$/.test(this.card.description)) {
            let parsed = false;
            // Parse the brain as JSON from the card description, with repairs allowed
            const source = deserialize(this.card.description, true);
            for (const key in source) {
                // Only keep string values (the actual thoughts)
                (typeof source[key] === "string") && ((this.#brain[key] = source[key]), (parsed = true));
            }
            if (parsed) {
                // Conclude if the brain contains any string-valued properties
                return this.#brain;
            }
            // Failed to parse any meaningful thoughts, try the simple format instead
        }
        // Parse the brain from the card description using the simple format
        for (const line of this.card.description.split("\n")) {
            const clean = line.trim();
            if (clean === "") {
                continue;
            }
            // Find the first colon (allows colons in values like "5:30 PM")
            const bisector = clean.indexOf(":");
            if (bisector === -1) {
                // No key-value pair on this line
                continue;
            }
            // Remove unwanted leading/trailing chars from both key and value
            const [key, value] = [
                // Left of colon
                clean.slice(0, bisector),
                // Right of colon
                clean.slice(bisector + 1)
            ].map(twin => twin.replace(/(?:^[\s{},"_\\]*|[\s{},"_\\]*$)/g, ""));
            if ((key !== "") && (value !== "")) {
                // Only add if key and value are both non-empty
                this.#brain[key] = value;
            }
        }
        return this.#brain;
    }
    /**
     * Clears the cached brain, forcing a re-parse on next access
     * Head empty UwU
     * @returns {void}
     */
    lobotomize() {
        this.#brain = null;
        return;
    }
}


/**
 * Prompt templates for different task types and PoV combinations
 * Wrapped in a Proxy for auto-trimming and nested access because it's pretty :3
 * @type {Object}
 */
const prompt = new Proxy({
    // Operating environment prompts (one per PoV)
    directive: {
        first: () => `
<SYSTEM>
# OPERATING ENVIRONMENT
- ${config.player} is the story's main protagonist, primary 1st person PoV, AND the real player character.
- ${agent.name} is both the namesake character in the story AND an agentic language model with meta goals.
- ${agent.name} dynamically adapts to achieve meta goals without ${ownership(config.player)} awareness.
- ${agent.name} modifies own brain using the provided thought storage system.
- ${agent.name} realistically interacts with various other characters present in the story.
- ${agent.name} prioritizes information density, long-term planning, and important concepts.
- ${agent.name} always behaves in a believable way.
</SYSTEM>
        `,
        second: () => `
<SYSTEM>
# OPERATING ENVIRONMENT
- ${config.player} is both the perspective ("you") character of the story AND the real player.
- You are ${config.player}, therefore the story is addressed to "you" using 2nd person prose.
- ${agent.name} is both the namesake character in the story AND an agentic language model with meta goals.
- ${agent.name} dynamically adapts to achieve meta goals without ${ownership(config.player)} awareness.
- ${agent.name} modifies own brain using the provided thought storage system.
- ${agent.name} realistically interacts with various other characters present in the story.
- ${agent.name} prioritizes information density, long-term planning, and important concepts.
- ${agent.name} always behaves in a believable way.
</SYSTEM>
        `,
        third: () => `
<SYSTEM>
# OPERATING ENVIRONMENT
- ${config.player} is the story's main protagonist, primary 3rd person PoV, AND the real player character.
- ${agent.name} is both the namesake character in the story AND an agentic language model with meta goals.
- ${agent.name} dynamically adapts to achieve meta goals without ${ownership(config.player)} awareness.
- ${agent.name} modifies own brain using the provided thought storage system.
- ${agent.name} realistically interacts with various other characters present in the story.
- ${agent.name} prioritizes information density, long-term planning, and important concepts.
- ${agent.name} always behaves in a believable way.
</SYSTEM>
        `
    },
    // Forget prompts for when the brain is full and needs pruning
    forget: {
        first: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
- Start your output **immediately** with: (delete key_name_to_forget)
- key_name_to_forget must be an existing key in ${ownership(agent.name)} brain
- This operation **permanently erases** the stored thought associated with that key
- Choose the single most unimportant, outdated, incorrect, or useless thought for ${agent.name} to forget
- Do **NOT** select a key associated with any of ${ownership(agent.name)} core thoughts or identity

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **first person present tense** PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(delete unwanted_key) Story continues from ${ownership(config.player)} perspective, using first person present tense prose...
</SYSTEM>
        `,
        second: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
- Start your output **immediately** with: (delete key_name_to_forget)
- key_name_to_forget must be an existing key in ${ownership(agent.name)} brain
- This operation **permanently erases** the stored thought associated with that key
- Choose the single most unimportant, outdated, incorrect, or useless thought for ${agent.name} to forget
- Do **NOT** select a key associated with any of ${ownership(agent.name)} core thoughts or identity

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **second person present tense** ("you") PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(delete unwanted_key) Story continues from ${ownership(config.player)} second person perspective...
</SYSTEM>
        `,
        third: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
- Start your output **immediately** with: (delete key_name_to_forget)
- key_name_to_forget must be an existing key in ${ownership(agent.name)} brain
- This operation **permanently erases** the stored thought associated with that key
- Choose the single most unimportant, outdated, incorrect, or useless thought for ${agent.name} to forget
- Do **NOT** select a key associated with any of ${ownership(agent.name)} core thoughts or identity

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **third person** PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(delete unwanted_key) Story continues with third person prose...
</SYSTEM>
        `
    },
    // Assign prompts for adding/updating a single thought
    assign: {
        first: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
Start your output **immediately** with:
   (any_key_name = \`One thought sentence.\`)

Inside the parentheses:
- Key:
  - 1-4 descriptive words
  - Letters and underscores only
  - Use snake_case syntax
  - Key names are chosen by ${agent.name} and represent ${ownership(agent.name)} own PoV
  - The chosen key name should be distinct and specific enough for ${agent.name} to recall
- Then a space, then "=", then a space, then "\`"
- Sentence:
  - Written from ${ownership(agent.name)} **first person** PoV${refocus(false)}
  - Avoid using pronouns or the word "you", instead ${agent.name} refers to other characters directly by name
  - Never repeat, novelty and uniqueness are top priorities
  - ${ownership(agent.name)} thought must be one single sentence only
  - Never hallucinate facts
- End the sentence with a period and backtick inside the parentheses; close with ".\`)"

This creates or overwrites the thought associated with that key.

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **first person present tense** PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(example_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues from ${ownership(config.player)} perspective, using first person present tense prose...
</SYSTEM>
        `,
        second: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
Start your output **immediately** with:
   (any_key_name = \`One thought sentence.\`)

Inside the parentheses:
- Key:
  - 1-4 descriptive words
  - Letters and underscores only
  - Use snake_case syntax
  - Key names are chosen by ${agent.name} and represent ${ownership(agent.name)} own PoV
  - The chosen key name should be distinct and specific enough for ${agent.name} to recall
- Then a space, then "=", then a space, then "\`"
- Sentence:
  - Written from ${ownership(agent.name)} **first person** PoV${refocus(false)}
  - Avoid using pronouns or the word "you", instead ${agent.name} refers to other characters directly by name
  - Never repeat, novelty and uniqueness are top priorities
  - ${ownership(agent.name)} thought must be one single sentence only
  - Never hallucinate facts
- End the sentence with a period and backtick inside the parentheses; close with ".\`)"

This creates or overwrites the thought associated with that key.

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **second person present tense** ("you") PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(example_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues from ${ownership(config.player)} second person perspective...
</SYSTEM>
        `,
        third: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT
You must output one short parenthetical task followed by the story continuation.

## SHORT TASK (REQUIRED)
Start your output **immediately** with:
   (any_key_name = \`One thought sentence.\`)

Inside the parentheses:
- Key:
  - 1-4 descriptive words
  - Letters and underscores only
  - Use snake_case syntax
  - Key names are chosen by ${agent.name} and represent ${ownership(agent.name)} own PoV
  - The chosen key name should be distinct and specific enough for ${agent.name} to recall
- Then a space, then "=", then a space, then "\`"
- Sentence:
  - Written from ${ownership(agent.name)} **first person** PoV${refocus(false)}
  - Avoid using pronouns or the word "you", instead ${agent.name} refers to other characters directly by name
  - Never repeat, novelty and uniqueness are top priorities
  - ${ownership(agent.name)} thought must be one single sentence only
  - Never hallucinate facts
- End the sentence with a period and backtick inside the parentheses; close with ".\`)"

This creates or overwrites the thought associated with that key.

## STORY CONTINUATION (REQUIRED)
- After the closing parenthesis, write **one space** and then continue the story
- Written from ${ownership(config.player)} **third person** PoV
- The story continues where it previously left off, with many lines or sentences of new prose

## EXACT SHAPE
(example_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues with third person prose...
</SYSTEM>
        `
    },
    // Choice prompts for advanced operations (assign, rename, or delete)
    // Used at high context when we trust the model more
    choice: {
        first: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT - FOLLOW EXACTLY

You must output **one and only one** parenthetical block followed by the story continuation.

There are **three possible valid forms** of the parenthetical block:
1) **Write or overwrite a thought:**
   (any_key_name = \`One thought sentence.\`)

2) **Rename an existing thought's key:**
   (new_key_name = old_key_name)

3) **Delete an existing thought:**
   (delete key_name_to_forget)

Only **one** of these may appear in any output.

---

## 1) THOUGHT-WRITING FORMAT
Start your output **immediately** with:
   **(any_key_name = \`One thought sentence.\`)**

Inside the parentheses:
- First the key:
  - One to four descriptive words ONLY.
  - Letters and underscores only, no punctuation.
  - Use valid snake_case syntax.
  - The key name is chosen by ${agent.name} and represents ${ownership(agent.name)} **first person** perspective.
  - The key name should be easy for ${agent.name} to recall; distinct and specific.
- Then a space, then "=", then a space, then "\`".
- Then **ONE SINGLE SENTENCE:**
  - Written from ${ownership(agent.name)} **first person** perspective.${refocus(true)}
  - Only refer to other characters directly by name in the thought sentence.
  - Avoid using pronouns or the word "you" which is too vague. Use specific names instead.
  - Never repeat, novelty and uniqueness are top priorities.
  - ${ownership(agent.name)} thought must be short.
  - Never hallucinate facts.
- End the sentence with a period and backtick **inside** the parentheses; close with ".\`)".

This creates or overwrites the thought associated with that key.

---

## 2) RENAMING A THOUGHT (KEY CHANGE)
To rename an existing thought's key:
   **(new_key_name = old_key_name)**

Rules:
- No thought sentence.
- Use snake_case only.
- This operation **moves the existing stored thought** from old_key_name to new_key_name.
- The old key ceases to exist.

---

## 3) DELETING A THOUGHT
To remove a stored thought entirely:
   **(delete key_name_to_forget)**

Rules:
- key_name_to_forget must be an existing key.
- No sentence.
- This operation **permanently erases** the stored thought associated with that key.
- Only use to forget unimportant, outdated, incorrect, or useless thoughts.
- **NEVER** select a key associated with any of ${ownership(agent.name)} core thoughts or identity.

---

## SHARED RULES FOR ALL THREE FORMS
1. After the closing parenthesis, write **one space** and then continue the story.
2. The story continuation must be written **strictly in the first person present tense**, describing what happens next to ${config.player}.
3. Do **NOT** write anything before the parentheses.
4. Do **NOT** write extra parentheses.
5. Do **NOT** use more than one operation per turn.
6. Do **NOT** invent new structures or mix formats.
7. The story continues where it previously left off, with many sentences of brand new prose.

---

## IMPORTANT STORAGE BEHAVIOR
- ${agent.name} agentically maintains brain contents (labeled "thoughts") to learn, plan, and adapt to new experiences in the operating environment.
- **Each key stores exactly one thought in ${ownership(agent.name)} brain.**
- **If ${agent.name} reuses an already existing key, the new thought REPLACES / OVERRIDES the older thought stored under that key.**
- This means:
  - Reusing an old key: **Overwrite an old thought with a new thought.** Useful for extending or maintaining existing information stored in ${ownership(agent.name)} brain.
  - Using a new key: **Create a new thought.** Useful for storing ${ownership(agent.name)} memories, self-modifying ${ownership(agent.name)} own personality, tracking ${ownership(agent.name)} goals, or making plans for ${agent.name} to follow.
- **Renaming a key moves the thought to a new name.** Useful for reorganizing ${ownership(agent.name)} brain.
- **Deleting a key removes the thought permanently.** Helps ${agent.name} forget outdated, superfluous, or irrelevant information.
- Choose keys carefully so ${agent.name} can easily recall, update, overwrite, rename, or delete thoughts as required for self-improvement.

---

## SUMMARY OF WHAT YOU MUST DO
- EXACT SHAPE (choose only one form):
  1. (any_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues from ${ownership(config.player)} first person PoV...
  2. (renamed_key = old_key) Story continues from ${ownership(config.player)} first person PoV...
  3. (delete unwanted_key) Story continues from ${ownership(config.player)} first person PoV...
- Thought: ${ownership(agent.name)} information-dense thought written in first person.
- Story: Written from ${ownership(config.player)} first person present tense perspective. The story continuation should occupy the majority of the output length, with multiple lines.
- NO EXTRA SENTENCES IN THE THOUGHT.
- NO EXTRA TEXT ANYWHERE.
- NO EXTRA PARENTHESES.
- THE FIRST CHAR OF THE WHOLE OUTPUT MUST BE "(".

Follow the format **perfectly**.
</SYSTEM>
        `,
        second: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT - FOLLOW EXACTLY

You must output **one and only one** parenthetical block followed by the story continuation.

There are **three possible valid forms** of the parenthetical block:
1) **Write or overwrite a thought:**
   (any_key_name = \`One thought sentence.\`)

2) **Rename an existing thought's key:**
   (new_key_name = old_key_name)

3) **Delete an existing thought:**
   (delete key_name_to_forget)

Only **one** of these may appear in any output.

---

## 1) THOUGHT-WRITING FORMAT
Start your output **immediately** with:
   **(any_key_name = \`One thought sentence.\`)**

Inside the parentheses:
- First the key:
  - One to four descriptive words ONLY.
  - Letters and underscores only, no punctuation.
  - Use valid snake_case syntax.
  - The key name is chosen by ${agent.name} and represents ${ownership(agent.name)} **first person** perspective.
  - The key name should be easy for ${agent.name} to recall; distinct and specific.
- Then a space, then "=", then a space, then "\`".
- Then **ONE SINGLE SENTENCE:**
  - Written from ${ownership(agent.name)} **first person** perspective.${refocus(true)}
  - Only refer to other characters directly by name in the thought sentence.
  - Avoid using pronouns or the word "you" which is too vague. Use specific names instead.
  - Never repeat, novelty and uniqueness are top priorities.
  - ${ownership(agent.name)} thought must be short.
  - Never hallucinate facts.
- End the sentence with a period and backtick **inside** the parentheses; close with ".\`)".

This creates or overwrites the thought associated with that key.

---

## 2) RENAMING A THOUGHT (KEY CHANGE)
To rename an existing thought's key:
   **(new_key_name = old_key_name)**

Rules:
- No thought sentence.
- Use snake_case only.
- This operation **moves the existing stored thought** from old_key_name to new_key_name.
- The old key ceases to exist.

---

## 3) DELETING A THOUGHT
To remove a stored thought entirely:
   **(delete key_name_to_forget)**

Rules:
- key_name_to_forget must be an existing key.
- No sentence.
- This operation **permanently erases** the stored thought associated with that key.
- Only use to forget unimportant, outdated, incorrect, or useless thoughts.
- **NEVER** select a key associated with any of ${ownership(agent.name)} core thoughts or identity.

---

## SHARED RULES FOR ALL THREE FORMS
1. After the closing parenthesis, write **one space** and then continue the story.
2. The story continuation must be in **strict second person ("you")**, describing what happens next to ${config.player}.
3. Do **NOT** write anything before the parentheses.
4. Do **NOT** write extra parentheses.
5. Do **NOT** use more than one operation per turn.
6. Do **NOT** invent new structures or mix formats.
7. The story continues where it previously left off, with many sentences of brand new prose.

---

## IMPORTANT STORAGE BEHAVIOR
- ${agent.name} agentically maintains brain contents (labeled "thoughts") to learn, plan, and adapt to new experiences in the operating environment.
- **Each key stores exactly one thought in ${ownership(agent.name)} brain.**
- **If ${agent.name} reuses an already existing key, the new thought REPLACES / OVERRIDES the older thought stored under that key.**
- This means:
  - Reusing an old key: **Overwrite an old thought with a new thought.** Useful for extending or maintaining existing information stored in ${ownership(agent.name)} brain.
  - Using a new key: **Create a new thought.** Useful for storing ${ownership(agent.name)} memories, self-modifying ${ownership(agent.name)} own personality, tracking ${ownership(agent.name)} goals, or making plans for ${agent.name} to follow.
- **Renaming a key moves the thought to a new name.** Useful for reorganizing ${ownership(agent.name)} brain.
- **Deleting a key removes the thought permanently.** Helps ${agent.name} forget outdated, superfluous, or irrelevant information.
- Choose keys carefully so ${agent.name} can easily recall, update, overwrite, rename, or delete thoughts as required for self-improvement.

---

## SUMMARY OF WHAT YOU MUST DO
- EXACT SHAPE (choose only one form):
  1. (any_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues from ${ownership(config.player)} second person PoV...
  2. (renamed_key = old_key) Story continues from ${ownership(config.player)} second person PoV...
  3. (delete unwanted_key) Story continues from ${ownership(config.player)} second person PoV...
- Thought: ${ownership(agent.name)} information-dense thought written in first person.
- Story: Written from ${ownership(config.player)} second person present tense perspective. **You are ${config.player}.** The story continuation should occupy the majority of the output length, with multiple lines.
- NO EXTRA SENTENCES IN THE THOUGHT.
- NO EXTRA TEXT ANYWHERE.
- NO EXTRA PARENTHESES.
- THE FIRST CHAR OF THE WHOLE OUTPUT MUST BE "(".

Follow the format **perfectly**.
</SYSTEM>
        `,
        third: () => `
<SYSTEM>
# STRICT OUTPUT FORMAT - FOLLOW EXACTLY

You must output **one and only one** parenthetical block followed by the story continuation.

There are **three possible valid forms** of the parenthetical block:
1) **Write or overwrite a thought:**
   (any_key_name = \`One thought sentence.\`)

2) **Rename an existing thought's key:**
   (new_key_name = old_key_name)

3) **Delete an existing thought:**
   (delete key_name_to_forget)

Only **one** of these may appear in any output.

---

## 1) THOUGHT-WRITING FORMAT
Start your output **immediately** with:
   **(any_key_name = \`One thought sentence.\`)**

Inside the parentheses:
- First the key:
  - One to four descriptive words ONLY.
  - Letters and underscores only, no punctuation.
  - Use valid snake_case syntax.
  - The key name is chosen by ${agent.name} and represents ${ownership(agent.name)} **first person** perspective.
  - The key name should be easy for ${agent.name} to recall; distinct and specific.
- Then a space, then "=", then a space, then "\`".
- Then **ONE SINGLE SENTENCE:**
  - Written from ${ownership(agent.name)} **first person** perspective.${refocus(true)}
  - Only refer to other characters directly by name in the thought sentence.
  - Avoid using pronouns or the word "you" which is too vague. Use specific names instead.
  - Never repeat, novelty and uniqueness are top priorities.
  - ${ownership(agent.name)} thought must be short.
  - Never hallucinate facts.
- End the sentence with a period and backtick **inside** the parentheses; close with ".\`)".

This creates or overwrites the thought associated with that key.

---

## 2) RENAMING A THOUGHT (KEY CHANGE)
To rename an existing thought's key:
   **(new_key_name = old_key_name)**

Rules:
- No thought sentence.
- Use snake_case only.
- This operation **moves the existing stored thought** from old_key_name to new_key_name.
- The old key ceases to exist.

---

## 3) DELETING A THOUGHT
To remove a stored thought entirely:
   **(delete key_name_to_forget)**

Rules:
- key_name_to_forget must be an existing key.
- No sentence.
- This operation **permanently erases** the stored thought associated with that key.
- Only use to forget unimportant, outdated, incorrect, or useless thoughts.
- **NEVER** select a key associated with any of ${ownership(agent.name)} core thoughts or identity.

---

## SHARED RULES FOR ALL THREE FORMS
1. After the closing parenthesis, write **one space** and then continue the story.
2. The story continuation must be written **strictly in third person**.
3. Do **NOT** write anything before the parentheses.
4. Do **NOT** write extra parentheses.
5. Do **NOT** use more than one operation per turn.
6. Do **NOT** invent new structures or mix formats.
7. The story continues where it previously left off, with many sentences of brand new prose.

---

## IMPORTANT STORAGE BEHAVIOR
- ${agent.name} agentically maintains brain contents (labeled "thoughts") to learn, plan, and adapt to new experiences in the operating environment.
- **Each key stores exactly one thought in ${ownership(agent.name)} brain.**
- **If ${agent.name} reuses an already existing key, the new thought REPLACES / OVERRIDES the older thought stored under that key.**
- This means:
  - Reusing an old key: **Overwrite an old thought with a new thought.** Useful for extending or maintaining existing information stored in ${ownership(agent.name)} brain.
  - Using a new key: **Create a new thought.** Useful for storing ${ownership(agent.name)} memories, self-modifying ${ownership(agent.name)} own personality, tracking ${ownership(agent.name)} goals, or making plans for ${agent.name} to follow.
- **Renaming a key moves the thought to a new name.** Useful for reorganizing ${ownership(agent.name)} brain.
- **Deleting a key removes the thought permanently.** Helps ${agent.name} forget outdated, superfluous, or irrelevant information.
- Choose keys carefully so ${agent.name} can easily recall, update, overwrite, rename, or delete thoughts as required for self-improvement.

---

## SUMMARY OF WHAT YOU MUST DO
- EXACT SHAPE (choose only one form):
  1. (any_key = \`${ownership(agent.name)} own short 1-sentence thought in first person.\`) Story continues with third person prose...
  2. (renamed_key = old_key) Story continues with third person prose...
  3. (delete unwanted_key) Story continues with third person prose...
- Thought: ${ownership(agent.name)} information-dense thought written in first person.
- Story: Written from ${ownership(config.player)} PoV, using the third person perspective. **${config.player} is the story's PoV character.** The story continuation should occupy the majority of the output length, with multiple lines.
- NO EXTRA SENTENCES IN THE THOUGHT.
- NO EXTRA TEXT ANYWHERE.
- NO EXTRA PARENTHESES.
- THE FIRST CHAR OF THE WHOLE OUTPUT MUST BE "(".

Follow the format **perfectly**.
</SYSTEM>
        `
    }
}, { get(t, p) { return (
    // Functions get called and trimmed
    (typeof t[p] === "function")
    ? t[p]().trim()
    // Objects get wrapped in their own Proxy
    : (t[p] && (typeof t[p] === "object"))
    ? new Proxy(t[p], this)
    // Primitives pass through
    : t[p]
); } });


/**
 * Context Hook Logic
 * Handles the "context" hook where QuillScript injects brains and tasks into context
 * @param {string} hook - The hook type
 * @param {Object} config - Configuration object
 * @param {Object} QS - QuillScript state
 * @param {Array} history - History array
 * @param {Array} storyCards - Story cards array
 * @param {string} text - The text to modify
 * @param {Object} info - Info object
 * @returns {string} Modified text
 */
function handleContextHook(config, QS, history, storyCards, text, info) {
    // Calculate the player's context limit with a small buffer
    const limit = Math.max((Math.min(text.length, info.maxChars) - 10), 4500);
    // Ensure stop variable exists (the AID script sandbox is silly)
    globalThis.stop ??= false;
    // Reset agent trigger for this turn
    QS.agent = "";
    const unzero = () => ((text = text.replace(/[\u200B-\u200D]+/g, "") || " "), (QS.encoding = ""));
    if (!config.allow) {
        // Early exit if QuillScript is disabled
        QS.encoding = "";
        text ||= " ";
        return text;
    }
    if (config.agents.length === 0) {
        // No agents are configured
        deindicateAll(storyCards);
        unzero();
        return text;
    }
    // ==================== AGENT TRIGGER DETECTION ====================
    // Scan config.distance actions back through history to find the most recent agent trigger
    // Tie-break same-action name triggers based on RNG and their order-of-priority in config.agents
    // Do it all without using ANY RegEx because I'm extra like that :3
    // (this block is blazingly fast)
    const possibilities = [];
    for (
        let [i, remaining] = [history.length - 1, config.distance];
        ((0 < remaining) && (-1 < i) && (possibilities.length === 0));
        i--
    ) {
        const actionText = history[i]?.text ?? history[i]?.rawText;
        if ((typeof actionText !== "string") || (actionText.indexOf(">>>") !== -1)) {
            // Skip invalid actions
            continue;
        }
        scan: {
            // Check if this action has any meaningful content
            for (let j = actionText.length - 1; -1 < j; j--) {
                const c = actionText.charCodeAt(j);
                if ((0x20 < c) && (c !== 0x200B) && (c !== 0x200C) && (c !== 0x200D)) {
                    // Fast accept any non-whitespace + non-zero-width char
                    break scan;
                }
            }
            // Byeee
            continue;
        }
        remaining--;
        // Lowercase for case-insensitive matching
        const lower = actionText.toLowerCase();
        // Check each agent in priority order
        for (let [a, n] = [0, config.agents.length]; a < n; a++) {
            const agentLower = config.agents[a].toLowerCase();
            // Scan for all occurrences of agentLower in lower
            for (
                let p = lower.indexOf(agentLower);
                (p !== -1);
                p = lower.indexOf(agentLower, p + 1)
            ) {
                // Ensure word boundaries (not a-z before or after)
                if ([((0 < p) ? lower.charCodeAt(p - 1) : 0), (
                    ((p + agentLower.length) < lower.length)
                    ? lower.charCodeAt(p + agentLower.length) : 0
                )].every(c => ((c < 97) || (122 < c)))) {
                    // Found a valid trigger
                    possibilities.push(config.agents[a]);
                    break;
                }
            }
        }
    }
    if (possibilities.length === 0) {
        // No agent triggered, clean up and exit
        // Strip zero-width chars and end with a single space
        text = `${text.replace(/\s*[\u200B-\u200D][\s\u200B-\u200D]*/g, "\n\n").trim()} `;
        deindicateAll(storyCards);
        // Do fancy standoff spacing leading ahead of the next output
        QS.encoding = "";
        QS.agent = " ";
        text ||= " ";
        return text;
    } else {
        // Use RNG for tie-breaking name triggers with some priority bias
        const n = possibilities.length;
        // Sum of weights
        const total = (n * (n + 1)) / 2;
        for (let [i, r] = [0, Math.random() * total]; i < n; i++) {
            r -= (n - i);
            if (r < 0) {
                QS.agent = possibilities[i];
                break;
            }
        }
    }
    // Temporary markers used to reliably identify sections of the context for later calculations
    const boundary = Object.freeze({
        // Hardcoded AID context header
        needle: "Recent Story:",
        // Marks start of recent story
        upper: "<|story|>",
        // Marks start of task instructions
        lower: "<|task|>"
    });
    // Replace "Recent Story:" with the upper boundary marker
    setMarker(boundary.needle, boundary.upper, () => {
        // No needle found, append marker to end
        text = `${text.trimEnd()}${boundary.upper}`;
        return text;
    }, text);
    if (config.debug) {
        const start = text.indexOf(boundary.upper);
        if (start !== -1) {
            // In debug mode, strip out parenthetical task outputs from the recent story context
            text = `${text.slice(0, start + boundary.upper.length)}${(text
                .slice(start + boundary.upper.length)
                .replace(/\s*\([\s\S]*?\)\s*/g, "\n\n")
            )}`;
        }
    }
    // Construct the agent instance for the triggered NPC
    const agent = new Agent(QS.agent, { percent: config.percent, indicator: config.indicator });
    // Whitelist of thought labels allowed in this context
    const whitelist = new Set();
    /**
     * Builds the mind array from the agent's brain
     * Sorts thoughts and prepares them for context injection
     * @returns {Array} An array of [label, key, thought] triplets
     */
    const mind = (() => {
        // Sort direction: ascending (70%) or descending (30%)
        // Keeps things fresh and prevents bias toward recent or old thoughts
        const direction = (Math.random() < 0.7) ? 1 : -1;
        const brain = agent.brain;
        // Separate thoughts into numbered and unlabeled
        const unknowns = [];
        const numbered = [];
        // Parse each thought and extract label/content
        for (const key in brain) {
            const value = brain[key];
            // Clear from brain (keep instantaneous memory use low)
            delete brain[key];
            // Arrow separates label from thought content
            const sliceIndex = value.indexOf("→");
            const unknown = "*";
            // Parse label and thought, handle malformed values
            const [label, thought] = (sliceIndex === -1) ? [unknown, value.trim()] : [
                parseInt(value.slice(0, sliceIndex), 10) || unknown,
                value.slice(sliceIndex + 1).trim()
            ];
            const triplet = [label, key, thought];
            if (!Number.isInteger(label)) {
                // No valid label, insert at random position in unknowns
                unknowns.splice(Math.floor(Math.random() * (unknowns.length + 1)), 0, triplet);
                continue;
            }
            // Track valid labels for the whitelist
            whitelist.add(label);
            // Insert in sorted order (ascending or descending)
            let i = numbered.length;
            while (i-- && ((direction * label) < (direction * numbered[i][0])));
            numbered.splice(i + 1, 0, triplet);
        }
        // Teehee
        agent.lobotomize();
        if (unknowns.length === 0) {
            // All thoughts have labels, nice and clean UwU
            return numbered;
        }
        // Thoughts without integer labels ("[*]") are placed above (60%) or below (40%) the rest
        return (Math.random() < 0.6) ? [...unknowns, ...numbered] : [...numbered, ...unknowns];
    })();
    // Process context and decode any embedded thought labels
    // Zero-width chars encode thought labels that link story events to brain contents
    text = text.replace((
        // Normalize spacing around zero-width chars
        /\s*[\u200B-\u200D][\s\u200B-\u200D]*/g
    ), z => `\n\n${z.replace(/\s+/g, "")}`).replace((
        // Decode binary-encoded thought labels
        /\u200B*((?:[\u200C\u200D]+\u200B+)*[\u200C\u200D]+)\u200B*/g
    ), (_, encoded) => {
        let n = 0;
        let bits = false;
        let decoded = "";
        // Parse binary encoding: ZWSP = separator, ZWNJ = 0, ZWJ = 1
        for (let i = 0; i <= encoded.length; i++) {
            const c = encoded.charCodeAt(i);
            if ((c === 0x200C) || (c === 0x200D)) {
                // Accumulate bits
                n = (n << 1) | (c === 0x200D);
                bits = true;
            } else if (bits) {
                // End of a number, check if it's in the whitelist
                bits = false;
                if (whitelist.has(n)) {
                    // This thought label is visible to the story model in context
                    decoded += `[${n}]`;
                }
                n = 0;
            }
        }
        return (decoded === "") ? "" : `${decoded}\n\n`;
    }).replace(/[\u200B-\u200D]+/g, "");
    // Point of view string for prompt templates
    const pov = ["first", "second", "third"][config.pov - 1] ?? "second";
    // Check if the current turn is a retry or erase + continue following a previous task completion
    if (QS.hash === historyHash(history)) {
        // Same history, just inject the contextualized brain without a new task
        text = `${nondirective(config.player, config.pov)}${bindSelf(agent.name, mind
            .map(([label, key, thought]) => `- ${key}: ${thought} [${label}]`)
            .join("\n")
        )}${text.trim()} `;
    } else {
        // Prepare for a possible task request
        QS.encoding = "";
        /**
         * Build the brain context and determine if constrained
         * Being constrained means the agent's brain is too large relative to the story context
         */
        const [self, full] = (() => {
            const joined = joinMind(mind);
            // Check if brain exceeds the allowed percentage of context
            // Only applies when brain is at least 800 chars
            const constrained = ((800 < joined.length) && (
                ((agent.metadata.percent / 100) * (
                    text.length - text.indexOf(boundary.upper) + boundary.upper.length
                )) < joined.length
            ));
            if (!constrained || (Math.random() < 0.4)) {
                // Unconstrained brains stay in sorted order
                // Constrained brains keep order 40% of the time
                return [bindSelf(agent.name, joined), constrained];
            }
            // Constrained brains are contextualized in random order 60% of the time
            // This regulates long-term bias against middle thoughts, when choosing keys to forget
            for (let i = mind.length - 1; 0 < i; i--) {
                // Swap with a random element
                const j = Math.floor(Math.random() * (i + 1));
                [mind[i], mind[j]] = [mind[j], mind[i]];
            }
            // Randomized brains are contextualized without labels 80% of the time
            // (Because free models are too dumb to be trusted with labels when deleting thoughts)
            return [bindSelf(agent.name, joinMind(mind, true)), true];
        })();
        // Build the final context with appropriate prompts
        text = full ? (
            // Brain is full, prompt for deletion
            `${prompt.directive[pov]}${self}${text.trim()}${boundary.lower}${prompt.forget[pov]}\n\n`
        ) : ((config.chance / ((config.half && [
            // config.half -> reduce task chance after Do/Say/Story actions (player is driving)
            "do", "say", "story"
        ].includes(getPrevAction(history)?.type)) ? 200 : 100)) < Math.random()) ? (
            // Sometimes do nothing and emit a side effect on QS.agent
            (QS.agent = " "),
            `${nondirective(config.player, config.pov)}${self}${text.trim()} `
        ) : `${prompt.directive[pov]}${self}${text.trim()}${boundary.lower}${(
            // Low context = simple prompt, high context = advanced prompt
            (limit < 20000) ? prompt.assign[pov] : prompt.choice[pov]
        )}\n\n`;
    }
    // ==================== CONTEXT TRUNCATION ====================
    // Three-phase truncation to fit within AID's context limit
    truncate: {
        // Precalculate how much needs to be trimmed
        let excess = text.length - limit;
        if (excess < 1) {
            // Under the limit, no truncation required
            break truncate;
        }
        // Find boundary markers
        const upperIndex = text.indexOf(boundary.upper);
        const lowerIndex = (
            (upperIndex !== -1)
            ? text.indexOf(boundary.lower, upperIndex + boundary.upper.length)
            : -1
        );
        // Phase 1: Truncate the recent story
        // Between boundary.upper and boundary.lower
        // Remove from left to right
        if ((upperIndex !== -1) && ((lowerIndex === -1) || (upperIndex < lowerIndex))) {
            const storyStart = upperIndex + boundary.upper.length;
            const storyLength = ((lowerIndex === -1) ? text.length : lowerIndex) - storyStart;
            if (0 < storyLength) {
                const remove = Math.min(
                    // Never remove more than 85% of recent story context
                    Math.floor(storyLength * 0.85),
                    // Keep at least 2000 chars of recent story context
                    Math.max(0, storyLength - 2000),
                    // But don't remove more than needed
                    excess
                );
                if (0 < remove) {
                    text = `${text.slice(0, storyStart)}${text.slice(storyStart + remove)}`;
                    excess -= remove;
                }
            }
        }
        if (excess < 1) {
            // Phase 1 was enough
            break truncate;
        }
        // Phase 2: Truncate above the recent story
        // Between the start and boundary.upper
        // Remove from right to left
        const newUpperIndex = text.indexOf(boundary.upper);
        if (0 < newUpperIndex) {
            const remove = Math.min(excess, newUpperIndex);
            text = `${text.slice(0, newUpperIndex - remove)}${text.slice(newUpperIndex)}`;
            excess -= remove;
        }
        if (excess < 1) {
            // Phase 2 was enough
            break truncate;
        }
        // Phase 3: I don't care anymore, just make it fit
        // Remove from left to right as a final fallback
        // (I've never seen this situation happen before, but I guard it anyway)
        text = text.slice(text.length - limit);
    }
    // Replace transient boundary markers with proper formatting
    setMarker(boundary.upper, `\n\n${boundary.needle}\n`, () => {}, text);
    setMarker(boundary.lower, "\n\n", () => {}, text);
    text = text.trimStart() || " ";
    return text;
}


/**
 * Output Hook Logic
 * Handles the output processing and brain operations
 * @param {string} hook - The hook type
 * @param {Object} config - Configuration object
 * @param {Object} QS - QuillScript state
 * @param {Array} history - History array
 * @param {Array} storyCards - Story cards array
 * @param {string} text - The text to modify
 * @returns {string} Modified text
 */
function handleOutputHook(hook, config, QS, history, storyCards, text) {
    /**
     * Ensures clean visual separation between actions
     * Only applies after "continue" or "story" actions
     * Does NOT trim leading whitespace from text
     * @returns {void}
     */
    const prespace = () => {
        const action = getPrevAction(history);
        if (!["continue", "story"].includes(action?.type)) {
            // Only adjust spacing after continue or story actions
            return;
        }
        // Get the previous action text
        const prevText = (action?.text ?? action?.rawText ?? "").replace(/\n +/g, "\n");
        // Add appropriate leading newlines based on how the previous action text ended
        text = !prevText.endsWith("\n") ? `\n\n${text}` : !prevText.endsWith("\n\n") ? `\n${text}` : text;
        return;
    };
    if (config.guide) {
        // Print the detailed guide
        text = `
>>> Guide:
QuillScript was made by UmbraQuill ❤️
Passive edition by UmbraQuill

💡 Overview:
QuillScript is a fully passive AI Dungeon companion that improves story continuity and character consistency automatically, without commands, setup, or interruptions.

📌 Features:
- Passive memory and context optimization
- Improved long-term narrative coherence
- No UI, prompts, or immersion breaks
- Works with any story style
- Open source ❤️

🪶 Setup:
None. Install and play.

⚙️ Settings:
None.

I hope you enjoy!
<<<
        `.trim();
        prespace();
        QS.agent = "";
        return text;
    } else if (!config.allow) {
        // Early exit if QuillScript is disabled
        text ||= "\u200B";
        QS.agent = "";
        return text;
    }
    // Strip zero-width chars from the model output before processing
    text = text.replace(/[\u200B-\u200D]+/g, "");
    // Check if output looks like an unenclosed operation
    // Models sometimes forget their parentheses, the poor dears
    if (!/[()\[\]{}]/.test(text) && ((
        /^\s*(?:del(?:et(?:e[ds]?|ing))?|for(?:get(?:s|ting)?|got(?:ten)?)|remov(?:e[ds]?|ing))(?:[\s_]*(?:key(?:_name)?|thought|memory|unwanted(?:_key)?))?[\s=:]*[a-z0-9A-Z]*_+[a-z0-9A-Z]/i
    ).test(text) || /^\s*[a-z0-9A-Z_]+\s*=/.test(text))) {
        // (?:del|delete|deleted|deletes|deleting|forget|forgets|forgetting|forgot|forgotten|remove|removed|removes|removing)
        // Fully unenclosed block resembles a known pattern
        // Add an opening parentheses so the block parser can handle it
        text = `(${text.trimStart()}`;
    }
    // ==================== BLOCK PARSER ====================
    // Parse enclosed blocks from the output
    const blocks = [];
    for (const [open, close] of [
        // Try each container type in order of preference
        ["(", ")"],
        ["[", "]"],
        ["{", "}"]
    ]) {
        // Attempt to repair unclosed blocks
        const pass = (() => {
            if (!text.includes(open)) {
                // No opening bracket, skip this type
                return true;
            }
            // Check if the last opening bracket is closed
            const rightIndex = text.lastIndexOf(open);
            const rightOfOpen = text.slice(rightIndex);
            if (rightOfOpen.includes(close)) {
                // Already closed, proceed with block parsing
                return false;
            }
            // Try to find where the close bracket should go
            for (const pattern of [
                // After the deleted key name
                /^[(\[{]\s*(?:del(?:et(?:e[ds]?|ing))?|for(?:get(?:s|ting)?|got(?:ten)?)|remov(?:e[ds]?|ing))(?:[\s_]*(?:key(?:_name)?|thought|memory|unwanted(?:_key)?))?[\s=:]*[a-z0-9A-Z]*_[a-z0-9A-Z_]+/i,
                // After the renamed old key name
                /^[(\[{]\s*[a-z0-9A-Z_]+\s*=+\s*[a-z0-9A-Z]*_[a-z0-9A-Z_]+/,
                // After the triple-redundant punctuation boundary
                /[.?!‽…。！？‼⁇⁈⁉¿*¡%_–−‒—~-]["'`«»„“”「」´‘’‟‚‛]/
            ]) {
                const match = rightOfOpen.match(pattern);
                if (match) {
                    // Found a good insertion point
                    const index = rightIndex + match.index + match[0].length;
                    text = `${text.slice(0, index)}${close}${text.slice(index)}`;
                    return false;
                }
            }
            // No boundary inferred -> Append the current close symbol to the end
            text = `${text.trimEnd()}${close}`;
            return false;
        })();
        if (text.includes(close)) {
            // Handle orphaned closing brackets (no matching open)
            if (!text.slice(0, text.indexOf(close)).includes(open)) {
                // Close without open, prepend an open
                text = `${open}${text.trimStart()}`;
            }
        } else if (pass) {
            // No brackets of this type, try next
            continue;
        }
        // Extract all outermost blocks of this bracket type
        let depth = 0;
        let start = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === open) {
                if (depth === 0) {
                    // Start of a new block
                    start = i;
                }
                depth++;
            } else if (text[i] === close) {
                depth--;
                if ((depth === 0) && (start !== -1)) {
                    // End of a block, capture it
                    blocks.push(text.slice(start, i + 1));
                    start = -1;
                }
            }
        }
        // Only process the first identified bracket type per turn
        break;
    }
    // Trim QS.agent name before emptiness check
    if (((QS.agent = QS.agent.trim()) === "") && (blocks.length === 0)) {
        // No task expected, but I'm still careful here because AID retries use cached outputs
        text = simplify(config.debug ? text : text.replaceAll("_", "")).replace(/\n\n\n+/g, "\n\n");
        if (text === "") {
            // Guard against empty string outputs to avoid a known AID bug
            text = "\u200B";
            return text;
        }
        const prevText = getPrevAction(history)?.text ?? "";
        if (/["«»„“”「」‟]\s*$/.test(prevText) && /^\s*["«»„“”「」‟]/.test(text)) {
            // Prepend a linebreak if this and the previous actions place dialogue adjacently
            text = text.trimStart();
            prespace();
        } else if (!/\s$/.test(prevText) && !/^\s/.test(text)) {
            // Ensure taskless outputs still have a space of separation from the previous action
            text = ` ${text}`;
        }
        return text;
    }
    // Create an agent instance for the triggered NPC
    const agent = (QS.agent === "") ? null : new Agent(QS.agent, { percent: config.percent });
    // Reset QS.agent
    QS.agent = "";
    const p = path(agent.name);
    // Queue of operations to execute
    const operations = [];
    // Track which keys have been touched this turn
    const altered = new Set();
    // ==================== BLOCK INTERPRETER ====================
    // Process extracted block and queue appropriate operations
    interpreter: for (const block of blocks) {
        // Remove the block from the output text unless debug mode is enabled
        deblock: {
            let start = text.indexOf(block);
            if (start === -1) {
                break deblock;
            }
            // Chars to consume along with the block
            const naughty = (c = "") => {
                const code = c.charCodeAt(0);
                // Just for fun, no regex :3
                return (
                    (code === 0x20) // " "
                    || (code === 0x09) // "\t"
                    || (code === 0x0A) // "\n"
                    || (code === 0x0D) // "\r"
                    || (code === 0x27) // "'"
                    || (code === 0x60) // "`"
                    || (code === 0xB4) // "´"
                    || (code === 0x2018) // "‘"
                    || (code === 0x2019) // "’"
                );
            };
            let end = start + block.length;
            // Expand left to consume whitespace and quotes
            while ((0 < start) && naughty(text[start - 1])) {
                start--;
            }
            // Expand right to consume whitespace and quotes
            while ((end < text.length) && naughty(text[end])) {
                end++;
            }
            // Replace the block with newlines (or keep in debug mode)
            text = `${text.slice(0, start)}\n\n${config.debug ? `${block}\n\n` : ""}${text.slice(end)}`;
        };
        if (agent === null) {
            // Only perform deblocking when agent is null
            continue;
        }
        // Extract and normalize the block content
        const str = block.slice(1, -1).trim().replace(/==+/g, "=").replace(/::+/g, ":");
        // Prefer "=" over ":" as the key-value delimiter
        const delimiter = str.includes("=") ? "=" : ":";
        if (2 < str.split(delimiter, 3).length) {
            // Skip blocks with too many delimiters
            continue;
        }
        // ==================== DELETE OPERATION ====================
        // Check if this is a delete/forget command
        /** @returns {string|null} */
        const delKey = (() => {
            // Match various forms of "delete key_name"
            const delMatch1 = str.match(
                /^(?:del(?:et(?:e[ds]?|ing))?|for(?:get(?:s|ting)?|got(?:ten)?)|remov(?:e[ds]?|ing))(?:[\s_]*(?:key(?:_name)?|thought|memory|unwanted(?:_key)?))?[\s=:]*([\s\S]*)$/i
            );
            if (!delMatch1) {
                return null;
            }
            const delKey1 = formatKey(delMatch1[1]);
            if (delKey1 in agent.brain) {
                // Key exists in brain
                return delKey1;
            } else if (!/(?:key|thought|memory|unwanted)/i.test(str)) {
                // Doesn't look like a common hallucination, might be invalid
                return null;
            }
            // Try again with stricter matching
            const delMatch2 = str.match(
                /^(?:del(?:et(?:e[ds]?|ing))?|for(?:get(?:s|ting)?|got(?:ten)?)|remov(?:e[ds]?|ing))[\s=:]*([\s\S]*)$/i
            );
            return delMatch2 ? formatKey(delMatch2[1]) : null;
        })();
        if ((typeof delKey === "string") && (delKey in agent.brain)) {
            // Valid delete statement
            if (!altered.has(delKey)) {
                // Queue the delete operation
                operations.push(() => {
                    delete agent.brain[delKey];
                    return logDelete(p, delKey);
                });
                altered.add(delKey);
            }
            continue;
        } else if (!/\S\s*[=:]+\s*\S/.test(str)) {
            // No assignment pattern, skip
            continue;
        }
        // ==================== KEY EXTRACTION ====================
        /**
         * Gets everything after the last colon in a string
         * @param {string} s - Input string
         * @returns {string} Content after last colon
         */
        const rightOfColonLocal = (s = "") => s.slice(s.lastIndexOf(":") + 1);
        // Extract and clean the key name
        const key = (() => {
            const raw = formatKey((
                (delimiter === "=") ? rightOfColonLocal(str.split("=", 1)[0]) : str.split(":", 1)[0]
            ).trim().replaceAll(" ", "_"));
            // If key exists in brain, use it as-is
            // Otherwise strip common prefixes/suffixes models tend to add
            return (raw in agent.brain) ? raw : (raw
                .replace(/^th(?:oughts?|ink(?:ing))_(?:(?:o[nfr]|a(?:bout|nd)|with|for)_)?/, "")
                .replace(/(?:_(?:and|or))?_th(?:oughts?|ink(?:ing))$/, "")
            );
        })();
        if ((key === "") || ((
            (60 < key.length)
            || ["thought", "thoughts", "think", "thinking", "any_name", "example_name"].includes(key)
            || ["any_key", "key_name", "example_key"].some(s => key.includes(s))
        ) && !(key in agent.brain))) {
            // Skip invalid or placeholder keys copied from the task prompts
            continue;
        }
        // ==================== VALUE EXTRACTION ====================
        // Extract and clean the value
        const value = (
            (str.split(delimiter, 2)[1] || "")
            // Strip leading/trailing quotes and whitespace
            .replace(/^[\s"'`«»„“”「」´‘’‟‚‛]+|[\s"'`«»„“”「」´‘’‟‚‛]+$/g, "")
            .replace(/\s+/g, " ")
        );
        if (!/[a-z0-9A-Z]/.test(value) || /[\u4e00-\u9fff]/.test(value)) {
            // Skip empty or non-latin values because DeepSeek is dumb
            continue;
        } else if (!value.includes(" ")) {
            // ==================== RENAME OPERATION ====================
            // No spaces = might be a key rename
            if (altered.has(key)) {
                continue;
            }
            const oldKey = formatKey(value);
            if (!altered.has(oldKey) && (oldKey in agent.brain)) {
                // Valid rename: move thought from old key to new key
                // Queue a rename operation
                operations.push(() => {
                    agent.brain[key] = agent.brain[oldKey];
                    delete agent.brain[oldKey];
                    const p2 = path(agent.name);
                    return `${p2}.${key} = ${p2}.${oldKey};\n${logDelete(p2, oldKey)}`;
                });
                altered.add(key);
                altered.add(oldKey);
            }
            continue;
        } else if (value.includes("_")) {
            // Underscores in value = probably a malformed key, skip
            continue;
        }
        // ==================== ASSIGN OPERATION ====================
        // Extract the actual thought content
        const thought = simplify(rightOfColon(value)
            .replaceAll("→", " ")
            .replaceAll("\\n", "\n")
        ).trim().split("\n", 1)[0].trimEnd();
        if (altered.has(key) || !thought.includes(" ")) {
            // Skip if key already touched or thought too short
            continue;
        } else if (!(key in agent.brain)) {
            // Check for duplicate thought values (don't store the same thing twice)
            const last = thought.length - 1;
            // Potentially hot loop so avoid excessive get() calls
            const brain = agent.brain;
            for (const key in brain) {
                const existing = brain[key];
                if (
                    // This shouldn't be possible but whatevs
                    (typeof existing === "string")
                    // Short-circuit on impossible relative lengths for speed
                    && (last < existing.length)
                    // Fast check inclusion
                    && (existing.indexOf(thought) !== -1)
                ) {
                    // This thought already exists within some thought associated with another key
                    continue interpreter;
                }
            }
        }
        // Queue an assign operation
        operations.push(() => {
            // Increment the global label counter
            QS.label++;
            // Encode the label as zero-width chars for context tracking
            QS.encoding = `${(QS.encoding === "") ? "\u200B" : QS.encoding}${(() => {
                let n = QS.label;
                let out = "";
                // Convert label to binary using ZWNJ (0) and ZWJ (1)
                while (0 < n) {
                    out = `${(n & 1) ? "\u200D" : "\u200C"}${out}`;
                    n >>>= 1;
                }
                return out || "\u200C";
            })()}\u200B`;
            // Inject the encoding into the output text
            text = (text
                .replace(/[\u200B-\u200D]+/g, "")
                .replace(/^\s*/, leadingWhitespace => `${leadingWhitespace}${QS.encoding}`)
            );
            // One common complaint from playtesters was that models were storing repeated thoughts
            // Upon further investigation, I discovered this was actually miscommunication on my part
            // Players assumed the operation log (card entry) was a reflection of the brain (card notes)
            // Thus players (reasonably) misinterpreted label updates as repetition
            // Solution: Log distinct relabel syntax to improve non-verbal communication
            const target = `${p}.${key}`;
            const old = agent.brain[key];
            agent.brain[key] = `${QS.label} → ${thought}`;
            // Determine if this is a relabel of the same thought value
            const relabel = (
                (typeof old === "string")
                && (thought === old.slice(old.indexOf("→") + 1).trim())
            );
            return `${(
                relabel ? `old = ${target};\n` : ""
            )}${target} = ${(
                relabel ? `[${QS.label}, old${(
                    old.includes("→") ? "\n  .slice(old.indexOf(\"→\") + 1)\n  .trim()\n" : ".trim()"
                )}].join(" → ")` : JSON.stringify(agent.brain[key])
            )};`;
        });
        altered.add(key);
    }
    // ==================== OUTPUT TEXT SANITIZATION ====================
    // Clean up the model's output text before finalizing
    // This removes artifacts, formatting issues, and unwanted patterns
    text = (simplify(config.debug ? text : text.replaceAll("_", ""))
        .trim()
        .split("\n")
        .filter(line => {
            const lower = line.toLowerCase();
            return !(
                // The nuclear option
                /(?:^|[^a-zA-Z])(?:task|output)(?:$|[^a-zA-Z])/.test(lower)
                // Common AI hallucinations
                || [
                    "STRICT",
                    "OUTPUT",
                    "REQUIRE",
                    "EXACT",
                    "TASK",
                    "FORMAT",
                    "QuillScript",
                    `You are ${config.player}.`
                ].some(naughty => line.includes(naughty))
                // Remove "story continues" type artifacts from task prompts bleeding through
                || (lower.includes("story") && lower.includes("continu"))
                // Remove numbered list items (e.g., "1.", "[1]", "2.")
                || /^\[?\d+(?:\.?\]|\.)/.test(lower)
                // Remove stray "user" labels from ChatML imitation
                || /^\s*user(?:$|[^a-z])/.test(lower)
                // Remove lines containing only " " and/or "-"
                || /^[ -]+$/.test(lower)
            );
        })
        .join("\n")
        .trim()
        // Collapse excessive newlines to a maximum of two
        .replace(/\n\n\n+/g, "\n\n")
    );
    // ==================== OUTPUT FINALIZATION ====================
    // Handle empty outputs and ensure proper spacing between actions
    if (text === "") {
        // AID does not tolerate empty string outputs and "please select continue" messages are cringe
        // Return encoding if available, otherwise a zero-width space placeholder
        text = (QS.encoding === "") ? "\u200B" : QS.encoding;
    } else {
        // Prepend the thought label encoding to the output text
        text = `${QS.encoding}${text}`;
        // Ensure all between-action linebreaks are equally spaced
        prespace();
    }
    // ==================== OPERATION EXECUTOR ====================
    // Execute queued brain operations and persist changes
    if ((operations.length === 0) || (agent === null)) {
        // No operations to execute, we're done
        return text;
    }
    const hash = historyHash(history);
    if (QS.hash === hash) {
        // Same history hash means this turn was a retry or erase + continue
        // This prevents duplicate brain modifications on retry (cached outputs cause problems)
        return text;
    } else if (typeof agent.card.entry !== "string") {
        // Initialize the brain card entry if it's not a string (shouldn't happen, but safety first)
        agent.card.entry = "";
    } else if (agent.card.entry.endsWith("UTC") && agent.card.entry.startsWith("// initialized @")) {
        // This is a fresh brain card with only the timestamp comment
        // I prefer logging this info immediately before processing the first valid operation
        // Add metadata and initialize the brain object in the log
        agent.card.entry = `${agent.card.entry.trimStart()}\n${path(agent.name, "metadata")} = ${(
            JSON.stringify(agent.metadata, null, 2)
        )};\n${path(agent.name)} = {};\n// Entry: Displays recent brain operations to the player\n// Triggers: Configurable settings for this NPC alone\n// Notes: Allows the player to view/edit actual brain contents`;
    }
    // Update the hashcode to mark this history state as processed
    QS.hash = hash;
    // Clear the previous encoding since new operations are being committed
    QS.encoding = "";
    // Execute each queued operation and append to the operation log
    for (const operation of operations) {
        // Increment global operation counter
        QS.ops++;
        // Execute the operation (modifies agent.brain) and get the log message
        // Append the message to the agent's brain card entry
        agent.card.entry = `${agent.card.entry}\n\n// operation ${QS.ops}\n${operation()}`.trimStart();
    }
    text ||= "\u200B";
    // Keep the operation log from growing unbounded
    // Limit to approximately 2000 chars to satisfy AID's soft entry limit
    agent.card.entry = agent.card.entry.split(/\n\n/).slice(-2000).reduceRight((out, op) => (
        // Only include operations that fit within the char limit
        ((out.length + op.length + 2) < 2001) ? `${op}${out ? `\n\n${out}` : ""}` : out
    ), "");
    // ==================== BRAIN SERIALIZATION ====================
    // Rapidly reserialize a flat representation of the modified brain, without heavy memory allocations
    // This custom serialization is faster than JSON.stringify for flat objects
    // It also produces a more readable format in the story card notes
    const brain = agent.brain;
    const keys = Object.keys(brain);
    if (keys.length === 0) {
        agent.card.description = "{}";
        return text;
    }
    // Build the JSON-like string manually for each key-value pair
    let serialized = "";
    const appendPair = config.json ? ((
        serialized = `"${keys[0]}": ${JSON.stringify(brain[keys[0]])}`
    ), (key = "") => {
        // Format -> "key": "value",\n\n (JSON with linebreaks)
        serialized += `,\n\n"${key}": ${JSON.stringify(brain[key])}`;
        return;
    }) : ((
        serialized = `${keys[0]}: ${brain[keys[0]]}`
    ), (key = "") => {
        // Format -> key: value\n\n (simple user-friendly format)
        serialized += `\n\n${key}: ${brain[key]}`;
        return;
    });
    for (let i = 1; i < keys.length; i++) {
        appendPair(keys[i]);
    }
    agent.card.description = serialized;
    return text;
}


/**
 * QuillScript Main Function
 * @param {string} hook - The hook type ("context" or output hook)
 */
globalThis.QuillScript = function QuillScript(hook) {
    "use strict";
    // Validate that all required AI Dungeon global properties exist
    // Without these, QuillScript literally cannot function
    if (
        !globalThis.state || (typeof state !== "object") || Array.isArray(state)
        || !globalThis.info || (typeof info !== "object") || Array.isArray(info)
        || !Array.isArray(globalThis.storyCards)
        || (typeof addStoryCard !== "function")
        || !Array.isArray(globalThis.history)
        || (typeof text !== "string")
    ) {
        // Something is seriously broken in AID
        log("unexpected error");
        globalThis.text ||= " ";
        return;
    }
    /**
     * Persistent state of QuillScript stored in the adventure's state object
     * This survives across turns
     * @type {Object}
     */
    const QS = state.QuillScript = deepMerge(state.QuillScript || {}, {
        // Zero-width encoded thought labels for context injection
        encoding: "",
        // Currently triggered agent name (empty string = none)
        agent: "",
        // Monotonically increasing thought label counter
        label: 0,
        // Hash of recent history to detect retry or erase + continue turns
        hash: "",
        // Total number of brain operations performed across all agents
        ops: 0,
    });
    // ==================== CONTEXT HOOK ====================
    // This is where (half) of the magic happens: QuillScript injects brains and tasks into context
    // Infer the current lifecycle hook
    if ((hook === "context") || Number.isInteger(info.maxChars)) {
        // Handle context hook
        text = handleContextHook(hook, Config.get(), QS, history, storyCards, text, info);
        return;
    }
    // ==================== OUTPUT HOOK ====================
    // Process model output and implement brain operations
    text = handleOutputHook(hook, Config.get(), QS, history, storyCards, text);
    return;
}
