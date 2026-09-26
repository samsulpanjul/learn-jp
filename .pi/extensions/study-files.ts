import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { requireStudy, sameStudy, relativeLog, studyPath, type StudyContext, type StudyKind } from "../lib/study-context.ts";
import { object, validateRecord } from "../lib/study-record.ts";

/** Guarded writes shared by setup and lessons; no tool judges Japanese. */
export default function studyFiles(pi: ExtensionAPI) {
	function result(text: string, details: Record<string, unknown>) {
		return { content: [{ type: "text" as const, text }], details };
	}
	async function mutate<T>(operation: (session: StudyContext) => T, kind?: StudyKind): Promise<T> {
		const session = requireStudy(pi, kind);
		return withFileMutationQueue(session.root, async () => {
			sameStudy(pi, session);
			if (session.busy) throw new Error("Finish the active question before writing study artifacts.");
			session.busy = true;
			try { return operation(session); }
			finally { session.busy = false; }
		});
	}
	function eligible(relative: string, operation: "create" | "append" | "replace") {
		if (relative === "setup.md" || relative.startsWith("sessions/") || relative.startsWith("records/") && operation !== "create") throw new Error("Setup markers, other session logs, and historical records are protected.");
		if (operation === "append" ? !relative.endsWith(".md") : !/\.(md|json)$/.test(relative)) throw new Error("Use a supported Markdown or JSON study file.");
		if (operation === "replace" && !["config.json", "curriculum/map.json", "progress/state.json"].includes(relative)) throw new Error("Only config.json, curriculum/map.json and progress/state.json are replaceable current state.");
		if (relative.startsWith("records/") && !relative.endsWith(".json")) throw new Error("Historical records must be JSON.");
	}
	function body(session: StudyContext, relative: string, content: string): string {
		if (!content.trim()) throw new Error("Study content must not be empty.");
		if (/<!--\s*(?:setup|lesson):complete/.test(content)) throw new Error("Only completion tools may write completion markers.");
		if (!relative.endsWith(".json")) return content;
		const value = object(JSON.parse(content), relative);
		return JSON.stringify(relative.startsWith("records/") ? validateRecord(value, session) : value, null, 2) + "\n";
	}
	function json(session: StudyContext, relative: string) {
		return object(JSON.parse(fs.readFileSync(studyPath(session.root, relative), "utf8")), relative);
	}
	pi.registerTool({
		name: "study_create_file", label: "Create study file",
		description: "During active setup OR lesson logging, exclusively create a study Markdown/JSON file. Records use schemaVersion 1 (docs/spec/records.md); question IDs are returned by ask_question/study_status and exact evidence is filled by this tool. Never overwrites. setup.md is created only by complete_setup.",
		parameters: Type.Object({ relativePath: Type.String(), content: Type.String() }),
		async execute(_id, input) {
			return mutate(session => {
				eligible(input.relativePath, "create");
				const content = body(session, input.relativePath, input.content);
				let target = studyPath(session.root, input.relativePath);
				fs.mkdirSync(path.dirname(target), { recursive: true });
				target = studyPath(session.root, input.relativePath);
				fs.writeFileSync(target, content, { encoding: "utf8", flag: "wx" });
				session.artifacts.add(input.relativePath);
				return result(`Created ${input.relativePath}`, { relativePath: input.relativePath });
			});
		},
	});
	pi.registerTool({
		name: "study_append_markdown", label: "Append study Markdown",
		description: "During active setup OR lesson logging, append to existing study Markdown or the active session log. Other session logs and setup.md are protected.",
		parameters: Type.Object({ relativePath: Type.String(), content: Type.String() }),
		async execute(_id, input) {
			return mutate(session => {
				const target = studyPath(session.root, input.relativePath);
				const content = body(session, input.relativePath, input.content);
				if (target === session.file) session.append(content);
				else {
					eligible(input.relativePath, "append");
					if (!fs.statSync(target).isFile()) throw new Error("Existing Markdown file required.");
					const fd = fs.openSync(target, "r+");
					try {
						const bytes = Buffer.from(content, "utf8");
						const position = fs.fstatSync(fd).size;
						let written = 0;
						while (written < bytes.length) {
							const count = fs.writeSync(fd, bytes, written, bytes.length - written, position + written);
							if (!count) throw new Error("Markdown append did not complete.");
							written += count;
						}
					} finally { fs.closeSync(fd); }
				}
				session.artifacts.add(input.relativePath);
				return result(`Appended to ${input.relativePath}`, { relativePath: input.relativePath });
			});
		},
	});
	pi.registerTool({
		name: "study_replace_json", label: "Replace study JSON",
		description: "During active setup OR lesson logging, atomically replace existing config.json, curriculum/map.json, or progress/state.json. Lessons without answered assessments must preserve assessed progress.",
		parameters: Type.Object({ relativePath: Type.String(), content: Type.String() }),
		async execute(_id, input) {
			return mutate(session => {
				eligible(input.relativePath, "replace");
				if (session.kind === "lesson" && input.relativePath === "progress/state.json" && !session.questions.some(question => question.status === "answered")) throw new Error("No assessment answers: preserve progress/state.json unchanged.");
				const target = studyPath(session.root, input.relativePath);
				json(session, input.relativePath);
				const content = body(session, input.relativePath, input.content);
				const temp = path.join(path.dirname(target), `.study-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
				try {
					fs.writeFileSync(temp, content, { encoding: "utf8", flag: "wx" });
					fs.renameSync(temp, target);
				} finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
				session.artifacts.add(input.relativePath);
				return result(`Replaced ${input.relativePath}`, { relativePath: input.relativePath });
			});
		},
	});
	function verify(session: StudyContext, recordPath: string, requiredPaths: string[]) {
		if (!/^records\/.+\.json$/.test(recordPath)) throw new Error("A new dated JSON record under records/ is required.");
		const record = validateRecord(json(session, recordPath), session, true);
		const required = [recordPath, "progress/state.json", "progress/summary.md", ...session.artifacts, ...requiredPaths];
		if (session.kind === "setup") required.push("config.json", "curriculum/map.json", "curriculum/map.md", "README.md");
		for (const relative of required) {
			const target = studyPath(session.root, relative);
			if (!fs.statSync(target).isFile() || !fs.readFileSync(target, "utf8").trim()) throw new Error(`Missing or empty artifact: ${relative}`);
			if (relative.endsWith(".json")) {
				const value = json(session, relative);
				if (!Object.keys(value).length) throw new Error(`Empty state object: ${relative}`);
			}
		}
		const state = json(session, "progress/state.json");
		if (record.evaluationStatus === "reviewed" && state.sourceRecord !== recordPath) throw new Error("Reviewed progress must reference this session's record via sourceRecord.");
		if (record.evaluationStatus === "not_attempted" && fs.readFileSync(studyPath(session.root, "progress/state.json"), "utf8") !== session.initialProgress) throw new Error("A lesson without evaluation must leave assessed progress unchanged.");
		if (!fs.readFileSync(studyPath(session.root, "progress/summary.md"), "utf8").includes(recordPath)) throw new Error("Progress summary must link this session's record.");
		return record;
	}
	pi.registerTool({
		name: "complete_setup", label: "Complete setup",
		description: "Validate the active setup record, initial state, curriculum and navigation, then exclusively create setup.md with its completion marker last. Keep the log active until success is announced, then stop_setup_log. Never writes a marker on validation failure.",
		parameters: Type.Object({ recordPath: Type.String(), requiredPaths: Type.Array(Type.String()) }),
		async execute(_id, input) {
			return mutate(session => {
				verify(session, input.recordPath, input.requiredPaths);
				const marker = studyPath(session.root, "setup.md");
				if (fs.existsSync(marker)) throw new Error("setup.md already exists; it will not be overwritten.");
				session.append(`Setup artifacts validated. Record: ${input.recordPath}`);
				// Exclusive creation preserves a partial file if the write fails.
				// Such a file is never interpreted as a successful setup.
				fs.writeFileSync(marker, `# Setup complete\n\nSaved at: ${new Date().toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})\n\n- [Setup log](${relativeLog(session)})\n- [Evidence](${input.recordPath})\n- [Curriculum](curriculum/map.md)\n- [Progress](progress/summary.md)\n\n<!-- setup:complete -->\n`, { encoding: "utf8", flag: "wx" });
				session.completed = true;
				return result(`Setup completed: ${marker}`, { completed: true, file: marker, record: input.recordPath });
			}, "setup");
		},
	});
	pi.registerTool({
		name: "complete_lesson", label: "Complete lesson",
		description: "Validate the active lesson's record and progress, then append its completion marker last. A lesson with no evaluation is valid only with evaluationStatus: not_attempted, rounds: [], a reason, and unchanged assessed progress. Announce success before stop_lesson_log.",
		parameters: Type.Object({ recordPath: Type.String(), requiredPaths: Type.Array(Type.String()) }),
		async execute(_id, input) {
			return mutate(session => {
				verify(session, input.recordPath, input.requiredPaths);
				if (fs.readFileSync(session.file, "utf8").includes("<!-- lesson:complete -->")) throw new Error("Lesson log is already marked complete.");
				session.append(`Lesson artifacts validated. Record: ${input.recordPath}\n\n<!-- lesson:complete -->`);
				session.completed = true;
				return result(`Lesson completed: ${relativeLog(session)}`, { completed: true, log: relativeLog(session), record: input.recordPath });
			}, "lesson");
		},
	});
}
