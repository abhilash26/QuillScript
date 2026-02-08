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
