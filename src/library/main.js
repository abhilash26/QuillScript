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
