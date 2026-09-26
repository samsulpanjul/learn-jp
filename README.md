# Learn Japanese with Pi

[![video](.pi/assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

My AI learning system from this video: [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

A fork/adaptation of [amosblomqvist/learn](https://github.com/amosblomqvist/learn), the original general-purpose AI learning setup for [Pi](https://github.com/earendil-works/pi). This version is **specialized for learning Japanese**: it assesses the learner's starting point, teaches one adaptive target per session, and tracks evidence-backed progress over time.

The project is intended for guided study with **Obsidian as the learning log and reference library**. Learner notes, answers, curriculum, and progress live in a separately linked Obsidian folder—not in this repository. Unlike the original general teaching flow, assessments here keep answer keys and judgments hidden until each round ends.

## How it works

1. Create a study folder outside this repository and link it with `/link-folder "<absolute path>"`.
2. Request `learning-setup` once for that folder. Setup asks about your goal, surveys Japanese skills across multiple areas, reviews all answers at the end, and builds an initial curriculum map. It does **not** start a lesson.
3. Request `learning-session` when you want to study. Each session chooses one target from the map and prior evidence, publishes material to a new Obsidian log, lets you ask questions, and starts evaluation **only when you choose it**. Answers are logged immediately; grading is disclosed at the end of the round.
4. At finalization, reviewed evidence updates progress and, when appropriate, a permanent reference page. Incomplete sessions are never counted as completed lessons.

No fixed textbook sequence, overall percentage score, automatic exam-level certification, or mandatory browsing is assumed. A text-only assessment does not claim to measure listening or speaking.

## Project files

| Path                                                                      | Purpose                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                               | Pi-loaded project instructions and a place for your own communication/teaching preferences. |
| `docs/spec/workflow.md`, `storage.md`, `curriculum.md`                    | Active study-system design.                                                                 |
| `.pi/skills/learning-setup/`, `learning-session/`, `japanese-assessment/` | Setup, lesson, and assessment behavior.                                                     |
| `.pi/extensions/folder-link.ts`                                           | Link an existing study folder for this Pi process.                                          |
| `.pi/extensions/setup-log.ts`, `lesson-log.ts`, `questions/`              | Append-only live logs and one-question-at-a-time input.                                     |
| `.pi/extensions/study-files.ts`                                           | Guarded writes and completion checks for setup and lesson artifacts.                        |
| `.pi/lib/`                                                                | Shared study lifecycle, path checks, and record validation.                                 |
| `docs/spec/records.md`                                                    | Versioned record format and finalization contract.                                          |
| `.pi/extensions/ask-user-question.ts`                                     | Ungraded preference and workflow choices.                                                   |
| `.pi/agents/researcher.md`                                                | Optional research subagent for a doubtful claim.                                            |

The legacy `.pi/extensions/md-log.ts` is separate from the study-session loggers. Add personal instructions to the **repository-root `AGENTS.md`**, not an Obsidian README; the latter is for navigation and explanations of the learner's files. Run `/reload` after changing project instructions, skills, or extensions. Re-link the study folder after restarting Pi.

Reload replaces active study logging state: do it between workflows. A new setup/lesson verifies a real log before questions begin; a missing, replaced, or unwritable log blocks further assessment. `study_status` reports the exact active path and captured answers. Do not infer an active log from an earlier chat message. Folder switching and legacy logging are unavailable while a study log is attached.

Setup saves through the same guarded file tools as lessons and finishes through `complete_setup`; only that tool creates `setup.md`. Lessons finish through `complete_lesson`. Finishing after reading without evaluation is supported: it records `not_attempted`, keeps assessed progress unchanged, and can still publish the lesson reference. A completion marker is not a mastery certificate.

## Requirements

- Pi with this repository as the working directory.
- A user-created study folder to link. Obsidian is the intended viewer for its Markdown logs.
- Optional: `pi-subagents` and `pi-web-access` for the research subagent. Setup and lessons can run without them; the agent must not invent citations or force a judgment when uncertain.
