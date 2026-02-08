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
  } catch { }
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
const setMarker = (substring = "", replacement = "", fallback = () => { }, text) => {
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
