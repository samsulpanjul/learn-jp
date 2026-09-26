# Linked folder, files, and evidence

See [workflow](workflow.md) and [curriculum](curriculum.md).

## Two locations

Pi runs from the **system repository** and reads its `.pi/skills/`, `.pi/extensions/`, `.pi/agents/`, and reference rules. Setup and study workflows **never write learner-specific data into that repository**. Repository changes require a separate system-development request.

The user creates and links an **Obsidian study folder outside the repository**. All study artifacts go there. General agent tools remain available for other work; this is a **workflow boundary, not an operating-system sandbox**. Study-specific tools must validate paths against the active linked root and never fall back to `process.cwd()`. External sources may be consulted for verification, but learner artifacts stay under the linked root.

## Intended root layout

```text
LEARNING-JAPANESE/
├── README.md
├── setup.md                       # created only after successful setup
├── config.json                     # current goals and configuration
├── curriculum/
│   ├── map.json                    # skills, local chapters, typed relations
│   ├── map.md                      # human-readable explanation
│   └── chapters/                  # chapter/subchapter indexes
├── materials/                      # permanent topic references, organized by chapter
│   └── grammar/verb-forms/te-form.md
├── sessions/
│   └── YYYY-MM-DD/
│       └── HH-mm-<topic>.md        # full lesson log
├── records/
│   └── YYYY-MM-DD-HH-mm-<topic>.json
├── progress/
│   ├── state.json                  # current per-skill summary
│   └── summary.md                 # human-readable history
└── visuals/                        # optional, not required for current sessions
```

A dated setup log is also created within the root; its current implementation uses `sessions/YYYY-MM-DD/HH-mm-setup.md`. The setup skill checks the final marker `<!-- setup:complete -->` in root `setup.md`, while also recognizing existing colon-suffixed completion markers. Mere folder/file existence does not count. An incomplete old log does not count as setup success. The completion marker is created **only after required setup artifacts succeed**.

Filenames need date and minute, not a random ID or seconds. If a filename exists, append `-2`, `-3`, etc. Include actual time **and timezone inside** the session/record. Neither file modification time nor material-creation time is evidence of the last assessment.

The linked folder's `README.md` explains and navigates the study artifacts; it is not an agent-instruction source. Pi loads the **repository-root `AGENTS.md`** as project context when run from this repository. The user can put personal communication and teaching preferences there for setup, lessons, and ordinary questions. It is project configuration, not learner progress; study artifacts still belong only in the linked folder. Changes to project instructions take effect after `/reload` or a new Pi session.

`config.json`, `curriculum/map.json`, and `progress/state.json` are current-state files; validated updates may replace them safely. **Existing Markdown remains append-only:** dated corrections go at the bottom, never over existing content. Do not silently replace prior session logs or dated records. Append new sections to `progress/summary.md`. New records follow the [version 1 contract](records.md). Per-file JSON replacement is atomic; cross-file transactional recovery remains open.

Setup and lessons both use `study_create_file`, `study_append_markdown`, and `study_replace_json`. `complete_setup` validates the required setup artifacts before exclusively creating `setup.md`; `complete_lesson` validates the record, progress, summary and touched/required artifacts before appending its marker. A lesson with no answered evaluation uses explicit `not_attempted` evidence and leaves assessed progress unchanged. Existing historical records are never migrated automatically.

The root and log are bound for the active workflow. Folder changes/unlinking and legacy logging are rejected while a study log is attached. Both logger starts reject repository roots. Assessment tools require a healthy active log and persist the question before opening UI and the answer before returning. Missing, replaced, truncated, or unwritable logs cause a persistent failure for that workflow, not silent recreation. `study_status` exposes actual state; reload/restart detaches logs and never resumes them automatically.

## Live log versus permanent material

- **One live Markdown log** records all *visible* agent–user text, terminal choices/inputs, questions, answers, end-of-round review, and finalization messages in order without duplicates. The setup/lesson trigger automatically links a new file; finalization unlinks it only after required writes succeed. Write each question before its UI waits, and the answer immediately after submission. Provisional grading, keys, and hidden tool output do not appear before round review.
- A **`materials/` page** is a stable, book-like reference, not a raw conversation transcript. Create the target page **at lesson finalization**, drawing from material the agent can explain confidently and clarifications that resolved the learner's questions. Do not label material externally verified unless a source was actually checked. An existing page receives appended dated corrections; historical sessions remain unchanged. A material page may link to another **existing** material page. Never create empty placeholder pages or broken links. Explain missing prerequisites inline until a real page exists. Once the target page exists, append a link to it at the end of the session file.
- Browsing is not required. If a **core claim remains genuinely doubtful** and no credible check is available, do not present it confidently or publish the disputed point as fact. A session may end with an explicit uncertainty exception in the log/progress, not a mastery claim. Uncertain side claims are omitted as facts from the permanent page.
- `curriculum/chapters/` is a table of contents pointing to `materials/`, not a duplicate textbook. Real Markdown links provide Obsidian's built-in graph edges; JSON map relations do **not** automatically appear there. Custom progress-colored graph rendering is deferred.

## Records, progress, and map

Each question record links to **session path and question number**. Store the target, format, displayed question, response, and timestamp; after review, add separate judgments for the target and observed older-skill mistakes, valid alternatives, ambiguity, reasons, and sources when used. During a closed round, provisional grading may remain only in extension/agent memory. An interrupted log retains visible answers but cannot justify a final mastery update.

`progress/state.json` summarizes each skill by aspect (such as recognition, production, application), last time **actually assessed**, recurring errors, next focus, and references to originating evidence. It is not a global percentage or the sole source of truth. Update it from reviewed evidence, not incidental appearances in sentences. One typo or ambiguous item is not a recurring error. Elapsed time without new evidence does **not** automatically lower a skill's status. `progress/summary.md` explains the decisions to the learner.

The curriculum map contains skill nodes and typed links, such as prerequisites, often-confused concepts, and concepts used together. User progress is an **overlay on this map**, not another graph. A single user mistake does not rewrite a conceptual dependency; map changes need a defensible curricular reason.
