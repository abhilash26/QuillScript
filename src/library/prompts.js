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
}, {
  get(t, p) {
    return (
      // Functions get called and trimmed
      (typeof t[p] === "function")
        ? t[p]().trim()
        // Objects get wrapped in their own Proxy
        : (t[p] && (typeof t[p] === "object"))
          ? new Proxy(t[p], this)
          // Primitives pass through
          : t[p]
    );
  }
});
