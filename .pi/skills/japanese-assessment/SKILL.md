---
name: japanese-assessment
description: Design and run adaptive Japanese-language assessments during initial setup or after a lesson. Use for choosing question tasks, invoking ask_question, interpreting answers privately, and revealing all feedback only after the round ends. Requires an active setup/session log.
---

# Japanese assessment

This skill specifies the **pedagogy and private decisions** of a round. The `ask_question` extension provides only three answer interfaces: `multiple_choice`, `free_text`, and `sentence_order`. The log extension mirrors visible questions and answers; neither tool grades. Do not use an instant-grading tool for this workflow: it would reveal the key after each answer.

## Before a round

- Only run within an explicitly started setup or lesson session with its Markdown log active. Do not start setup/session implicitly. A separate orchestrator owns the workflow stages and the final progress update. `ask_question` checks the actual log, writes the question before opening UI, and writes the answer before returning. If it reports a logging error, stop the round immediately; do not bypass it with an unlogged question tool or shell script. `study_status` reports the real context and captured IDs; do not assume an old conversation message proves logging is active.
- Know the purpose: **setup assessment** maps a broad text-assessable starting profile before choosing a first lesson; **lesson evaluation** tests one current target in several contexts. Read the user's goal, relevant curriculum/prerequisites, and available evidence. Do not infer an official exam level from a few answers.
- Make a private coverage plan, _not_ a fixed list of ten questions. For setup, track kana/appropriate kanji reading, vocabulary, particles/structure, verb/adjective forms, reading comprehension, and independent production/application across varied functions and situations. Track recognition separately from production, the demonstrated floor and next uncertain boundary, and which strands remain untested. For lesson evaluation, identify the target skills and missing evidence (recognition, recall, explanation, production, application); keep the current lesson target central.
- Check Japanese correctness before asking. Know what the prompt tests, an expected answer, plausible valid alternatives, and how you would tell a target error from an incidental error. For a genuinely uncertain rule, nuance, or key, check a credible source if available; otherwise use a different item rather than inventing a key. External checks are not mandatory for familiar material. Do not create a misleading question just to fill a quota.

## Select a task, then an interface

The **task** is not the tool format. Pick tasks based on the evidence needed; adjust vocabulary and difficulty to the learner's observed abilities. Examples:

| Task                                                                 | `ask_question` kind              | Evidence                                   |
| -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ |
| Choose a grammar form/particle to complete a sentence                | `multiple_choice`                | Recognition or discrimination              |
| Choose an appropriate response to a situation                        | `multiple_choice`                | Meaning and usage                          |
| Fill a blank without hints                                           | `free_text`                      | Recall                                     |
| Transform a form/sentence                                            | `free_text`                      | Forming the target                         |
| Translate into Japanese                                              | `free_text`                      | Production (allow equivalent translations) |
| Write a response to a real situation                                 | `free_text`                      | Application                                |
| Repair a sentence and/or explain the error                           | `free_text`                      | Diagnosis                                  |
| Explain the contrast between examples                                | `free_text`                      | Understanding                              |
| Read a short passage/dialogue and answer                             | `multiple_choice` or `free_text` | Comprehension in context                   |
| Order fragments within a sentence (optionally with surrounding text) | `sentence_order`                 | Structure                                  |

Use question wording and generated options in the language appropriate to the user, while Japanese examples stay in Japanese. A beginner should not need a long passage or unlearned vocabulary merely to answer a basic grammar question. Add a new context when rechecking a suspected misconception; do not repeat the same prompt with a cosmetic word swap.

- `multiple_choice`: pass **exactly four plain answer texts** without numbering or letter prefixes; the interface handles choice labels. The UI adds `I don't know`; **never include your own opt-out option**. No `Other` in multiple choice. Ensure one intended answer is unambiguously best on the question's stated reading. Keep distractors plausible, parallel, and similar in length; each should diagnose a distinct possible mistake. If multiple options are genuinely valid, rewrite the item or choose free text.
- `free_text`: the user can write an answer or choose `I don't know`. Accept alternative grammatical Japanese expressions that satisfy the requested meaning and target. Do not demand exact string equality.
- `sentence_order`: pass **2–8 shuffled fragments** (usually 3–4 for a beginner). The user chooses every fragment through the UI; **no distractor** and no typed index sequence. Prefer meaningful fragments over arbitrary single words. Ensure the requested sentence has an unambiguous order, or recognize any other valid order during review. The UI offers Undo, Reset, Submit, and `I don't know`.

## Run the round

1. Call `ask_question` **once**, wait for the answer, and read its result before choosing the next question. Never send all questions at once. A `dontKnow` result means the learner did not guess; it is not evidence for a particular misconception. A cancelled question is not a wrong answer.
2. Internally inspect the answer to adapt the next item. Distinguish the _current target_, observed errors in older material, minor typing issues, and genuinely ambiguous responses. For setup, first survey **across** strands; move up within a strand when evidence is strong or check a prerequisite when weak, but after a few diagnostic items return to other strands. Do not let one expression monopolize setup merely because it exposed a gap. For a lesson, retry a target difficulty in a different context or progress toward production/application; preserve coverage of the main target.
3. **Do not say correct/incorrect, reveal a key, offer a hint, explain a solution, or emit a per-item score between questions**, including in chat that the user is reading through Obsidian. A neutral transition is okay. Never put keys/grades in the `ask_question` arguments, visible log, or a tool result. The UI result gives the agent the submitted answer automatically; rereading the whole Markdown file after every question is unnecessary.
4. Stop a lesson round when varied evidence is sufficient to judge the target **or** the limiting difficulty is clear and more questions would not improve the decision. Around ten questions is a _planning target_, not a mandatory minimum/maximum or an automatic 80% pass line. For setup, stop only after broad text-assessable coverage and targeted follow-up make an initial profile and first lesson choice defensible; do not stop at the first teachable gap. There is no question-count or time cap, but avoid redundant items. Mark unassessable or genuinely untested aspects unknown. The user can terminate the process; an interrupted round remains partial and cannot justify a mastery claim.
5. **Only after the round ends**, disclose every question's assessment, reasoning, valid alternatives, recurring patterns, uncertainty, and an honest conclusion. This review is visible and logged. Later Q&A contains no surprise quiz. An optional repeat is a **new round with different questions**, with results again held until its end.

## Grading free responses

Judge separately: (a) meaning in the situation, (b) the target grammar/form, (c) _observed_ older-skill errors, (d) spelling/typing, and (e) ambiguity. A mistake on the form being tested is not automatically a harmless typo. A side mistake does not automatically erase success on the current target. Call something a minor typo only when the intended form is clear, it is outside the tested target, and fixing it does not change the grammatical analysis. Do not promote a single typo or ambiguous answer to a persistent weakness.

If a response could be valid under a reasonable nuance or the item itself permits several answers, mark it uncertain privately and consult a credible source if available. A second model's unsupported confidence is not verification. If the ambiguity remains, tell the user at the **end-of-round review** and do not count the item against them. User objections to grading are evidence to reconsider, not something to defend reflexively.

Keep every conclusion traceable to the logged question and answer. A score may be shown as a rough summary, but it never replaces the per-skill evidence or certifies durable mastery. The session/setup workflow, not this skill alone, writes final records and progress.
