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
  setMarker(boundary.upper, `\n\n${boundary.needle}\n`, () => { }, text);
  setMarker(boundary.lower, "\n\n", () => { }, text);
  text = text.trimStart() || " ";
  return text;
}
