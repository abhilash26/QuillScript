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
        {
          message: "Enable QuillScript:", ...factory(
            "allow", S.IS_QS_ENABLED_BY_DEFAULT
          )
        },
        {
          message: "Show detailed guide:",
          builder: (cfg = {}, hook = "", info = {}) => ` ${(
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
        {
          message: "Adventure in 1st, 2nd, or 3rd person:", ...factory(
            "pov", S.FIRST_SECOND_OR_THIRD_PERSON_POV,
            { lower: 1, upper: 3, suffix: () => ["st", "nd", "rd"][config.pov - 1] ?? "" }
          )
        },
        {
          message: "Max brain size relative to story context:", ...factory(
            "percent", S.PERCENTAGE_OF_RECENT_STORY_USED_FOR_BRAINS,
            { lower: 1, upper: 95, suffix: "%" }
          )
        },
        {
          message: "Recent turns searched for name triggers:", ...factory(
            "distance", S.NUMBER_OF_ACTIONS_TO_LOOK_BACK_FOR_TRIGGERS,
            { lower: 1, upper: 250 }
          )
        },
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
        {
          message: "Thought formation chance per turn:", ...factory(
            "chance", S.THOUGHT_FORMATION_CHANCE_PER_TURN,
            { lower: 0, upper: 100, suffix: "%" }
          )
        },
        {
          message: "Half thought chance for Do/Say/Story:", ...factory(
            "half", S.IS_THOUGHT_CHANCE_HALF_FOR_DO_SAY_STORY
          )
        },
        {
          message: "Brain card notes store brains as JSON:", ...factory(
            "json", S.IS_JSON_FORMAT_USED_FOR_BRAIN_CARD_NOTES
          )
        },
        {
          message: "Enable debug mode to see model tasks:", ...factory(
            "debug", S.IS_DEBUG_MODE_ENABLED_BY_DEFAULT
          )
        },
        {
          message: "Pin this config card near the top:", ...factory(
            "pin", S.IS_CONFIG_CARD_PINNED_BY_DEFAULT
          )
        },
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
  }
}
