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
