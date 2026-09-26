# Study record contract (version 1)

Read this when finalizing setup or a lesson. Existing historical records are not migrated or rewritten. New records are exclusively created through `study_create_file` while the originating log is active.

## Reviewed setup or lesson

Use the `session` path and question `id` values returned by `study_status` / `ask_question`. Supply the tutor's reviewed judgments; the tool fills exact prompts, options, fragments, submitted answers, opt-outs, and question/answer timestamps from the active logger. Do not copy or invent those fields. The complete stored record is checked against the captured evidence again at finalization.

```json
{
  "schemaVersion": 1,
  "kind": "setup",
  "session": "sessions/2026-09-26/23-15-setup.md",
  "timestamp": "2026-09-26T23:45:00+07:00",
  "timezone": "Asia/Jakarta",
  "target": "Initial profile across text-assessable Japanese strands",
  "evaluationStatus": "reviewed",
  "rounds": [
    {
      "number": 1,
      "reviewed": true,
      "questions": [
        {
          "id": "actual-id-returned-by-ask_question",
          "target": "Greeting in a daytime situation",
          "judgment": {
            "outcome": "correct",
            "reason": "The submitted greeting fits the stated situation."
          },
          "alternatives": ["Other valid responses, if relevant"],
          "incidentalErrors": [],
          "sources": []
        }
      ]
    }
  ]
}
```

Replace the example paths, dates, IDs, and content with actual values. `kind` is `setup` or `lesson` and must match the active logger. Rounds are numbered consecutively from 1; every submitted answer appears exactly once across all rounds. `judgment.outcome` is `correct`, `incorrect`, `uncertain`, or `not_attempted`, with a nonempty reason. `I don't know` is `not_attempted`; it is not a guessed error. Ambiguity is `uncertain` and must not count against the learner. Add aspect-specific observations, valid alternatives, incidental errors, source links actually consulted, and the next-target rationale as appropriate.

`reviewed: true` is the tutor's assertion that results have already been disclosed; the tool validates structural evidence, not Japanese correctness or the meaning of the review prose. Do not write reviewed records during a closed round. Cancelled questions are copied automatically to `cancelledQuestions` and do not need a judgment. An unanswered pending question prevents finalization.

For reviewed evidence, `progress/state.json` is a nonempty object whose `sourceRecord` equals the new record's relative path. Preserve prior skills and describe observed aspects, actual assessment time, uncertainty, and evidence references. Append a human-readable explanation including the new record path to `progress/summary.md`. The current-state per-skill structure remains flexible; structural validation does not certify mastery.

## Lesson finished without evaluation

This is a successful session ending, not a proficiency result. It is not an allowed substitute for setup assessment.

```json
{
  "schemaVersion": 1,
  "kind": "lesson",
  "session": "sessions/2026-09-26/23-50-greetings.md",
  "timestamp": "2026-09-27T00:05:00+07:00",
  "timezone": "Asia/Jakarta",
  "target": "Greetings",
  "evaluationStatus": "not_attempted",
  "reason": "The learner chose to finish after reading and Q&A.",
  "rounds": []
}
```

Keep `progress/state.json` byte-for-byte unchanged, including last-assessed dates. Append the material covered and the absence of evaluation to `progress/summary.md`, linking this record. Publish a reference page when justified and then call `complete_lesson`. The tool rejects this branch if any assessment question was answered. A cancelled question alone is not an answer and remains visible in `cancelledQuestions`.

## Completion and failures

- Setup: save config, map JSON/Markdown, reviewed record, progress JSON/summary, and README navigation. `complete_setup({ recordPath, requiredPaths: [] })` validates them and exclusively creates root `setup.md` with its marker last. Never create setup.md through general write tools.
- Lesson: `complete_lesson({ recordPath, requiredPaths })` validates the record, progress, summary, every artifact changed by the guarded tools, and any additional required paths; it appends the session completion marker last.
- Announce success only after the completion tool succeeds, then detach with the corresponding stop tool. Completion means the required artifacts passed validation; it does not certify language mastery.
- On a malformed record, correct the input before creating a file. Existing records cannot be replaced: if a record already exists and a corrected one is needed, create a new suffixed record and update progress references. Keep the old evidence intact.
- A missing required artifact leaves the workflow incomplete. The same active workflow may retry finalization after fixing that artifact through guarded tools. A lost/replaced/unwritable log instead blocks the workflow: do not recreate it or silently continue. Stop, report the problem, and use a new explicit workflow trigger.
- Reload/session restart clears log state; old conversation claims do not prove that a logger is active. Call `study_status` and use only its returned paths. No automatic resume or scan of unrelated vault folders.
- JSON replacement is atomic per file, not a transaction across the entire folder. A failed finalization can leave partial artifacts, but it must not receive a completion marker. Failed setup.md creation may leave an incomplete marker file for manual inspection.
