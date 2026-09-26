import { relativeLog, type StudyContext } from "./study-context.ts";

export function object(value: any, label: string): Record<string, any> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
	return value;
}
function text(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be nonempty text.`);
}

/** Grade content is the tutor's responsibility; structural evidence is checked here. */
export function validateRecord(value: any, session: StudyContext, stored = false): Record<string, any> {
	const record = object(value, "Record");
	if (record.schemaVersion !== 1) throw new Error("Record schemaVersion must be 1. See docs/spec/records.md.");
	if (record.kind !== session.kind || record.session !== relativeLog(session)) throw new Error("Record kind and session must match the active study log.");
	text(record.target, "Record target");
	text(record.timestamp, "Record timestamp");
	if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(record.timestamp) || !Number.isFinite(Date.parse(record.timestamp))) throw new Error("Record timestamp must be an ISO timestamp with an offset.");
	text(record.timezone, "Record timezone");
	try { new Intl.DateTimeFormat("en", { timeZone: record.timezone }); } catch { throw new Error("Record timezone must be an IANA timezone."); }
	if (!Array.isArray(record.rounds)) throw new Error("Record rounds is required; use [] only when no evaluation was attempted.");
	if (session.questions.some(question => question.status === "pending")) throw new Error("An assessment question has not finished.");
	const answered = session.questions.filter(question => question.status === "answered");
	if (record.evaluationStatus === "not_attempted") {
		if (session.kind === "setup" || answered.length || record.rounds.length) throw new Error("not_attempted is only valid for a lesson without answered assessment questions.");
		text(record.reason, "Reason for no evaluation");
	} else if (record.evaluationStatus === "reviewed") {
		if (!answered.length || !record.rounds.length) throw new Error("Reviewed evaluation requires answered questions and reviewed rounds.");
	} else throw new Error("evaluationStatus must explicitly be reviewed or not_attempted.");
	const seen = new Set<string>();
	const rounds = record.rounds.map((round: any, index: number) => {
		object(round, "Round");
		if (round.number !== index + 1 || round.reviewed !== true || !Array.isArray(round.questions) || !round.questions.length) throw new Error("Each round needs a consecutive number, reviewed: true, and nonempty questions.");
		return { ...round, questions: round.questions.map((entry: any) => {
			object(entry, "Question review");
			const captured = answered.find(question => question.id === entry.id);
			if (!captured || seen.has(entry.id)) throw new Error("Question IDs must refer to distinct answers captured by this active log.");
			seen.add(entry.id);
			text(entry.target, "Question target");
			const judgment = object(entry.judgment, "Question judgment");
			if (!["correct", "incorrect", "uncertain", "not_attempted"].includes(judgment.outcome)) throw new Error("Invalid judgment outcome.");
			if (captured.dontKnow && judgment.outcome !== "not_attempted") throw new Error("I don't know must be recorded as not_attempted, not a guessed error.");
			text(judgment.reason, "Judgment reason");
			if (stored) for (const [key, original] of Object.entries(captured)) {
				if (JSON.stringify(entry[key]) !== JSON.stringify(original)) throw new Error(`Stored question ${entry.id} does not match the captured ${key}.`);
			}
			// The tool supplies exact prompts, options, answers and times, avoiding
			// hand-copied evidence or timestamps invented by the model.
			return { ...entry, ...captured };
		}) };
	});
	if (seen.size !== answered.length) throw new Error("Every answered question must appear in the reviewed record before completion.");
	const cancelledQuestions = session.questions.filter(question => question.status === "cancelled");
	if (stored && JSON.stringify(record.cancelledQuestions) !== JSON.stringify(cancelledQuestions)) throw new Error("Cancelled questions do not match the active log.");
	return { ...record, rounds, cancelledQuestions };
}
