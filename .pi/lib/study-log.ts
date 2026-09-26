import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { activeStudy, callout, linkedRoot, relativeLog, studyPath, type StudyContext, type StudyKind } from "./study-context.ts";

const setupComplete = /<!-- setup:complete(?::[a-z0-9-]+)? -->\s*$/;

/** Both workflows share one lifecycle and a fail-closed append-only writer. */
export function registerStudyLog(pi: ExtensionAPI, kind: StudyKind) {
	let active: StudyContext | null = null;
	const pending = new Set<string>();
	pi.events.on("learning:context-request", data => {
		if (active) (data as { reply: (value: StudyContext) => void }).reply(active);
	});
	pi.events.on("learning:log-request", data => {
		(data as { reply: (kind: string, active: boolean, file: string | null) => void }).reply(kind, active !== null, active?.file ?? null);
	});
	function detach(ctx: ExtensionContext) {
		active = null;
		pending.clear();
		ctx.ui.setStatus(`${kind}-log`, undefined);
	}
	pi.on("session_start", async (_event, ctx) => detach(ctx));
	pi.on("session_shutdown", async (_event, ctx) => detach(ctx));

	function start(ctx: ExtensionContext, topic = "setup"): StudyContext {
		if (activeStudy(pi)) throw new Error("Stop the active study log before starting another.");
		let legacy = false;
		pi.events.emit("md-log:active-request", { reply: (value: boolean) => { legacy = value; } });
		if (legacy) throw new Error("Stop legacy logging with /md-unlog before starting study logging.");
		const root = linkedRoot(pi);
		const marker = studyPath(root, "setup.md");
		const markerExists = fs.existsSync(marker);
		const completed = markerExists && setupComplete.test(fs.readFileSync(marker, "utf8"));
		if (kind === "setup" && markerExists) throw new Error(completed ? "Setup is already complete. Start a lesson instead." : "setup.md is incomplete; inspect it before starting a new setup.");
		if (kind === "lesson" && !completed) throw new Error("Setup is not complete in the linked folder.");
		const title = topic.trim().replace(/[\r\n]+/g, " ").slice(0, 100);
		if (!title) throw new Error("Lesson topic is required.");
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const slug = kind === "setup" ? "setup" : title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "lesson";
		const directory = studyPath(root, `sessions/${date}`);
		fs.mkdirSync(directory, { recursive: true });
		studyPath(root, `sessions/${date}`);
		const progress = studyPath(root, "progress/state.json");
		const initialProgress = fs.existsSync(progress) ? fs.readFileSync(progress, "utf8") : null;
		if (kind === "lesson" && initialProgress === null) throw new Error("Setup progress/state.json is missing; cannot start a lesson.");
		if (initialProgress !== null) JSON.parse(initialProgress);
		for (let index = 1; index <= 100; index++) {
			const relative = `sessions/${date}/${time}-${slug}${index === 1 ? "" : `-${index}`}.md`;
			const file = studyPath(root, relative);
			try {
				fs.writeFileSync(file, `# ${kind === "setup" ? "Setup" : "Lesson"} — ${title}\n\nStarted at: ${now.toISOString()} (${zone})\nStatus: in progress; an unfinished log is not a mastery claim.\n`, { encoding: "utf8", flag: "wx" });
			} catch (error: any) { if (error?.code === "EEXIST") continue; throw error; }
			const original = fs.statSync(file);
			let failure: string | null = null;
			const session: StudyContext = {
				kind, root, file, initialProgress, questions: [], artifacts: new Set(), completed: false, busy: false,
				fail(error) {
					failure ??= `Study log failed: ${error instanceof Error ? error.message : String(error)}. Stop this workflow; do not continue questions or mark it complete.`;
					ctx.ui.notify(failure, "error");
				},
				check() {
					if (failure) throw new Error(failure);
					try {
						if (linkedRoot(pi) !== root) throw new Error("Linked folder changed during study logging.");
						studyPath(root, relative);
						const stat = fs.statSync(file);
						if (!stat.isFile() || stat.dev !== original.dev || stat.ino !== original.ino || stat.size < original.size) throw new Error("Study log was replaced or truncated.");
						fs.accessSync(file, fs.constants.R_OK | fs.constants.W_OK);
					} catch (error) { session.fail(error); throw new Error(failure!); }
				},
				append(text) {
					if (!text.trim()) return;
					session.check();
					try {
						// r+ refuses to recreate a deleted log (appendFile's default 'a' would).
						const fd = fs.openSync(file, "r+");
						try {
							const stat = fs.fstatSync(fd);
							if (stat.dev !== original.dev || stat.ino !== original.ino) throw new Error("Study log changed before append.");
							const bytes = Buffer.from(`\n${text}\n`, "utf8");
							let written = 0;
							while (written < bytes.length) {
								const count = fs.writeSync(fd, bytes, written, bytes.length - written, stat.size + written);
								if (!count) throw new Error("Study log append did not complete.");
								written += count;
							}
							fs.fsyncSync(fd);
							original.size = stat.size + written;
						} finally { fs.closeSync(fd); }
					} catch (error) { session.fail(error); throw new Error(failure!); }
				},
			};
			active = session;
			session.check();
			if (ctx.hasUI) ctx.ui.setStatus(`${kind}-log`, `📝 ${kind}: ${path.basename(file)}`);
			return session;
		}
		throw new Error("No free study log filename found for this minute.");
	}

	pi.registerTool({
		name: `start_${kind}_log`, label: `Start ${kind} log`,
		description: `Create and verify a new append-only ${kind} log in the linked folder. Returns the exact path; never invent one. Does not certify completion.`,
		parameters: kind === "setup" ? Type.Object({}) : Type.Object({ topic: Type.String() }),
		async execute(_id, input, _signal, _update, ctx) {
			const session = start(ctx, kind === "setup" ? "setup" : (input as { topic: string }).topic);
			return { content: [{ type: "text" as const, text: `${kind} log created and verified: ${session.file}\nTell the user to open this exact path in Obsidian.` }], details: { file: session.file, root: session.root, kind, active: true } };
		},
	});
	pi.registerTool({
		name: `stop_${kind}_log`, label: `Stop ${kind} log`,
		description: `Detach ${kind} logging after completion or explicit cancellation. Never marks it complete.`,
		parameters: Type.Object({}),
		async execute(_id, _input, _signal, _update, ctx) {
			if (active?.busy) throw new Error("Wait for the current study operation before stopping the log.");
			const file = active?.file ?? null;
			detach(ctx);
			return { content: [{ type: "text" as const, text: file ? `Stopped ${kind} log: ${file}` : `No ${kind} log is active.` }], details: { file, stopped: file !== null } };
		},
	});
	if (kind === "setup") {
		pi.registerCommand("start-setup-log", { description: "Start a new setup log", handler: async (_args, ctx) => {
			try { ctx.ui.notify(`Setup log linked: ${start(ctx).file}`, "info"); }
			catch (error) { ctx.ui.notify(String(error), "error"); }
		} });
		pi.registerCommand("stop-setup-log", { description: "Stop setup logging without completing setup", handler: async (_args, ctx) => {
			if (active?.busy) { ctx.ui.notify("Wait for the current study operation.", "warning"); return; }
			detach(ctx);
		} });
	}
	if (kind === "lesson") pi.registerTool({
		name: "study_status", label: "Study status",
		description: "Read the real active setup/lesson log and captured ungraded questions. Use after starting a log or to diagnose failures. Never invent a log path or reconstruct missing timestamps.",
		parameters: Type.Object({}),
		async execute() {
			const session = activeStudy(pi);
			if (!session) return { content: [{ type: "text" as const, text: "No setup or lesson log is active. Start the appropriate log before continuing." }], details: { active: false } };
			session.check();
			const details = { active: true, kind: session.kind, root: session.root, file: session.file, session: relativeLog(session), completed: session.completed, questions: session.questions };
			return { content: [{ type: "text" as const, text: JSON.stringify(details) }], details };
		},
	});
	pi.on("message_end", async event => {
		if (!active) return;
		const message = event.message as any;
		if (message.role !== "user" && message.role !== "assistant") return;
		const text = typeof message.content === "string" ? message.content : (message.content ?? []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n\n");
		if (text.trim()) active.append(`> [!${message.role === "user" ? "quote" : "abstract"}] ${message.role === "user" ? "YOU" : "PI"}\n\n${text}`);
	});
	// Assessment questions record directly in execute(), before and after the UI.
	pi.on("tool_call", async (event: any) => {
		if (!active || event.toolName !== "ask_user_question") return;
		if (active.completed) return { block: true, reason: "Study is complete; stop its log before asking further questions." };
		if (active.busy) return { block: true, reason: "Another study operation is still running; ask study questions sequentially." };
		try {
			const input = event.input ?? {};
			const body = [input.question ?? "", input.details ?? "", ...(input.options ?? []).map((option: any, index: number) => `${index + 1}. ${option.label}${option.description ? ` — ${option.description}` : ""}`)].filter(Boolean).join("\n");
			active.append(callout("question", `Question — ${new Date().toISOString()}`, body));
			pending.add(event.toolCallId);
			active.busy = true;
		} catch (error) { return { block: true, reason: String(error) }; }
	});
	pi.on("tool_result", async (event: any) => {
		if (!active || event.toolName !== "ask_user_question" || !pending.delete(event.toolCallId)) return;
		try {
			const details = event.details ?? {};
			const answer = details.status === "answered" ? (details.answers ?? []).map((item: any) => item.label).join("\n") : `(${details.status ?? "unavailable"})`;
			active.append(callout("example", `Answer — ${new Date().toISOString()}`, answer));
		} catch (error) {
			return { content: [{ type: "text" as const, text: `${String(error)}\nThe submitted answer remains in tool details, but was not safely logged.` }], isError: true };
		} finally { active.busy = false; }
	});
}
