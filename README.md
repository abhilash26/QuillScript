# QuillScript 🪶
### *Fully passive narrative improvements for AI Dungeon*
Made by UmbraQuill ❤️
Forked from *Inner Self*

---

## Overview

QuillScript is a **fully passive** AI Dungeon mod that quietly improves story continuity, character consistency, and long-term narrative coherence.

It does **not** add explicit agents, editable NPC minds, commands, UI elements, or configuration.
Once installed, QuillScript runs automatically in the background, refining context, memory usage, and text quality without interrupting gameplay or player agency.

If a feature cannot be made passive, it is intentionally removed.

---

## Main Features

| Feature | Description |
|:--------|:------------|
| **Passive Context Optimization** | Automatically stabilizes story context and reduces drift |
| **Character Consistency** | Improves perspective, dialogue, and role continuity over time |
| **Memory Pruning** | Silently compresses and prioritizes relevant narrative details |
| **Text Normalization** | Cleans and formats input/output automatically |
| **Zero Immersion Breaks** | No prompts, indicators, debug text, or UI elements |
| **Universal Compatibility** | Works with any genre, PoV, or story style |

---

## What QuillScript Does *Not* Do

- No NPC “brains” or editable mind cards
- No Auto-Cards
- No name-based triggers
- No visual indicators
- No config cards or settings
- No commands or activation steps

---

## Permission

QuillScript is free and open-source.
You are welcome to use, fork, modify, or publish it in your own scenarios or scripts. ❤️

---

## Scenario Script Install Guide

1. Use the [AI Dungeon website](https://aidungeon.com/) (desktop view)
2. Create or edit a scenario
3. Open the `DETAILS` tab → enable `Scripts`
4. Select `EDIT SCRIPTS`

### Input tab

```js
QuillScript("input");
const modifier = (text) => ({ text });
modifier(text);
```

### Context tab

```js
QuillScript("context");
const modifier = (text) => ({ text, stop });
modifier(text);
```

### Output tab

```js
QuillScript("output");
const modifier = (text) => ({ text });
modifier(text);
```

### Library tab

1. Delete all existing code
2. Open the compiled library file:
   - [Library code](./src/library.js)
3. Copy **all** contents into the Library tab
4. Click **SAVE**

### Done

All adventures using this scenario will now include QuillScript automatically.

## Gameplay Notes

- No setup or configuration is required
- Write normally — QuillScript adapts silently
- Especially effective in long-running stories
- Safe to remove at any time

---

## Credits
- Original project: [Inner Self](https://github.com/LewdLeah/Inner-Self)
- Passive refactor and continuation: **UmbraQuill**

## License
Free and open-source ❤️

---

Made with ❤️ by UmbraQuill
