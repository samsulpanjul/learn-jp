---
name: learning-setup
description: >-
  Run the one-time initial setup for a user-created, linked Japanese-study folder.
  Use when explicitly requested to collect goals, run a privately assessed adaptive
  probe, show all results at the end, and initialize curriculum and progress
  without starting a lesson.
---

# Initial setup — Japanese study

This skill runs **once per linked folder**. It is an orchestrator, not a lesson or an exam certification. Read `../japanese-assessment/SKILL.md` before the probe. Repository files are read-only during a study workflow; write study data only inside the linked folder.

## 1. Preconditions — do not create anything yet

1. Call `folder_root`. If nothing is linked, stop and ask the user to run `/link-folder "<absolute existing folder>"`. Never guess a root from the current working directory or use the repo as the root.
2. Inspect `<root>/setup.md` **before** calling `start_setup_log`. A completed root has a final completion marker in that file: `<!-- setup:complete -->` (also recognize an existing marker with a colon-suffixed identifier after `setup:complete`). If found, stop: direct the user to a normal study session. Reassessment/reset is not supported; restarting from scratch requires a new folder and a new link.
3. If `setup.md` exists but has no completion marker, treat it as an inconsistent partial finalization; **do not overwrite it or claim setup complete**. Explain the problem and stop for manual inspection. A prior incomplete _session log_ without `setup.md` is not a completed setup: leave it untouched and start a new log.
4. Pi loads the repository-root `AGENTS.md` automatically when run from this repository; follow its personal preferences without reading the linked folder's README as an instruction source. Do not assume an empty folder is a completed setup. Linking a folder and completing setup are separate operations. If relevant JSON exists from an interrupted attempt, inspect it before continuing; it may be replaced only as current state after new reviewed results, never treated as evidence of prior mastery by mere presence.

## 2. Start the live log, then discover the goal

Call `start_setup_log`, then `study_status`. Continue only if both succeed and status reports the active setup log. Tell the user the exact returned file path to open in Obsidian; never construct one from memory. If logging is absent or fails, stop before asking goals or assessment questions. Do not search unrelated vault folders or bypass the logger. From this point until `stop_setup_log`, visible assistant text, user text, `ask_user_question` exchanges, and `ask_question` exchanges are mirrored into that file. Do not create or link another log during this setup. Do not call `/md-log` on it.

Use `ask_user_question` for **ungraded decisions/preferences**, not for assessing knowledge:

- Ask the nearest Japanese-learning goal. A test name, work, travel, reading, conversation, or an open goal is acceptable. Do not hard-code one exam as the system's center.
- Ask at most a few _purposeful_ follow-ups when they change the plan: whether the target is a checkpoint toward another use, relevant work setting if offered, previous learning experience, and practical reading/writing constraints. Accept “I don't know yet”; do not conduct an endless interview.
- Record context as supporting information for examples/vocabulary, **not** as a substitute for a sensible Japanese prerequisite path. Self-reported proficiency is a starting hypothesis, not a measured result.

## 3. Adaptive probe — results hidden until the end

Use the `japanese-assessment` skill and `ask_question` for **graded-in-principle** knowledge probes; the tool itself does not grade. This is a **broad initial assessment**, not a hunt for the first teachable gap. Privately plan coverage across the text-assessable strands: kana/appropriate kanji reading, everyday vocabulary, particles and sentence structure, verb/adjective forms, short-text comprehension, and independent production/application. Vary grammar functions and situations within each strand; the user's goal guides relevance but must not collapse the assessment into one expression or work scenario. Listening and spoken interaction cannot be inferred from text-only tasks: record them as unknown, not weak.

First take a broad survey across those strands using the goal and self-report only as hypotheses. In each relevant strand, adapt difficulty upward on demonstrated success or inspect a prerequisite after a miss. Seek evidence at more than one difficulty/context and mix recognition with production where the interface permits. Keep a private coverage matrix of observed floor, uncertain boundary, production versus recognition, and missing evidence. **Do not spend the whole setup drilling the first discovered gap:** use a few distinct nearby tasks to distinguish a slip from a real gap, then return to other strands. After broad coverage, revisit the most decision-relevant uncertainties and compare several possible first lesson targets by prerequisite readiness. One question per call; choose the next from the latest response and the coverage matrix, not a fixed quiz list. Do not turn the broader assessment into a single official level label.

Use the available formats deliberately: `multiple_choice` (four plain answer texts; the UI adds labels and `I don't know`), `free_text`, and `sentence_order` (2–8 fragments, all used). Agent-generated question wording/options may follow the user's language. Keep each item unambiguous and level-appropriate; external source checks are optional unless the agent is genuinely uncertain. If uncertainty cannot be resolved, choose a different item rather than guessing. The user sees each question/answer in the live setup log. **Do not reveal correctness, hints, answer keys, grades, or per-question explanations between questions**, including in ordinary chat or an Obsidian-visible tool output. Do not use any tool that reveals answers instantly.

**Stopping rule:** do not stop merely because one pattern such as `ので` or `〜たら` presents a teachable gap. Finish only when each text-assessable strand has either enough varied evidence for a provisional floor and next boundary, or an explicit reason it cannot be assessed with this interface or goal; the most relevant gaps have been checked against prerequisites; and more questions would not materially change the initial map or choice among plausible first targets. There is **no preset question count or time limit**. Avoid redundant drills once a strand is understood; move to a new strand or difficulty instead. Mark genuinely untested aspects `unknown`, not `unable`. If evidence suggests the learner is beyond an initial map segment, investigate the relevant JF Can-do and prerequisites on demand—do not cap the learner at A2, force a restart, or invent a higher-level syllabus. A CEFR/JF or exam level inferred from this assessment is **not** an official certification.

## 4. Review openly, then initialize state

After the _entire_ probe ends, present a consolidated review: questions and responses, correct or valid alternative answers with reasons, ambiguous items that cannot be scored, observations **by strand and by recognition/production**, several plausible starting areas considered, the reason for the selected target, and unknown areas. If an answer's validity is in doubt, consult credible sources when available; otherwise mark it uncertain and do not count it against the learner. A second model's unsupported opinion is not verification. Accept user corrections; record their effect rather than quietly changing the story. Explain the proposed **first lesson target and why**, using evidence and prerequisites. Continue finalization without asking the learner to approve the diagnosis.

Read `../../../docs/spec/records.md` for the versioned record contract. While the setup log remains active, use `study_create_file`, `study_append_markdown`, and `study_replace_json` for all setup artifact writes, sequentially. These tools support setup as well as lessons. Do not use general-purpose write/edit/bash or ad-hoc scripts to bypass them. Initialize only the data justified by the probe:

- `<root>/config.json`: goal, optional use context, and source/format metadata. No private guesses presented as facts.
- `<root>/curriculum/map.json` and `map.md`: a **small, expandable** local map tied to JF Can-do and defensible language prerequisites. Do not manufacture a complete A1–C2 graph or copy textbook content. Explain uncertain/unmapped areas explicitly.
- `<root>/records/<dated-setup-name>.json`: a version 1 setup record with `evaluationStatus: "reviewed"`, reviewed rounds and a judgment for every captured answer ID. The tool fills exact prompts, answers and timestamps from the active log; obtain IDs from `study_status`. Include ambiguity and the rationale for the first target.
- `<root>/progress/state.json` and `summary.md`: provisional observations across the assessed strands and aspects, explicit unknowns, timestamp only where actually tested, and links to evidence; set `sourceRecord` to this setup record path. The summary must include that path. No one-number mastery score.
- `<root>/README.md`: a short navigation page explaining the learner's study folder with links to the map, progress summary, and setup log. Do not put personal agent instructions there. If it already exists, append navigation at the end rather than replacing its content.

Use actual date/time with timezone inside the artifacts. JSON current-state files may be replaced after validation; **existing Markdown may only receive new content appended at the end**. Never overwrite previous setup logs, user notes, or existing `map.md`/`summary.md`. New files must be inside the linked root. Do not create `materials/` or start a lesson during setup. If any required write fails, report it while the log is active; do not create a completion marker. Avoid claiming setup succeeded merely because some files now exist.

Only **after** all required artifacts have been written, call `complete_setup` with `recordPath` and any additional `requiredPaths`. It validates the captured evidence and required files, then exclusively creates `<root>/setup.md` with its completion marker last. Never create this marker yourself. On failure, report it while the log is still active and do not claim success. If only an artifact is missing, fix it through guarded tools and retry; if the logger has failed, stop the workflow instead of recreating or guessing a log. After tool success, announce setup completion and the first lesson target, then call `stop_setup_log`. A stopped/reloaded process never resumes an old log; the next explicit trigger starts a new workflow.

## Correction — no learner approval of the diagnosis

This rule **supersedes** the earlier instruction to ask the learner to confirm the proposed first lesson target. After reviewing the probe, the agent must choose the starting target from evidence, check uncertain language facts when sources are available, explain the reasoning, and save setup **without an approval question**. Do not ask the learner to judge whether a question, answer key, proficiency conclusion, or teaching sequence is correct. The learner is not responsible for validating the tutor. They may voluntarily correct their goals, practical constraints, or factual information about their experience; incorporate such corrections, but do not make agreement with the agent's pedagogical choice a prerequisite for completing setup. Store `proposedFirstTarget` with evidence and rationale, not `userConfirmedTarget` or an equivalent approval flag.
