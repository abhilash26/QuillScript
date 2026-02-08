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
