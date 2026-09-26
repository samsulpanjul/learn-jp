import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type StudyKind = "setup" | "lesson";
export interface CapturedQuestion {
	id: string;
	kind: string;
	question: string;
	options: string[];
	pieces: string[];
	askedAt: string;
	answeredAt?: string;
	status: "pending" | "answered" | "cancelled";
	answer?: string;
	dontKnow?: boolean;
	choiceIndex?: number;
	order?: number[];
}
export interface StudyContext {
	kind: StudyKind;
	root: string;
	file: string;
	questions: CapturedQuestion[];
	artifacts: Set<string>;
	initialProgress: string | null;
	completed: boolean;
	busy: boolean;
	check(): void;
	append(text: string): void;
	fail(error: unknown): void;
}

export function inside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function validateRoot(candidate: string): string {
	const root = fs.realpathSync(candidate);
	if (!fs.statSync(root).isDirectory()) throw new Error("Linked root is not a directory.");
	const repository = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
	if (inside(repository, root)) throw new Error("Study folders must be outside the system repository.");
	return root;
}

export function linkedRoot(pi: ExtensionAPI): string {
	let root: string | null = null;
	pi.events.emit("folder:root-request", { reply: (value: string | null) => { root = value; } });
	if (!root) throw new Error("No folder linked. Run /link-folder <absolute-path> first.");
	return validateRoot(root);
}

// Reply synchronously: Pi's event bus does not await listeners. Validate in the
// caller because errors thrown inside event-bus listeners are swallowed by Pi.
export function activeStudy(pi: ExtensionAPI): StudyContext | null {
	const active: StudyContext[] = [];
	pi.events.emit("learning:context-request", { reply: (value: StudyContext) => { active.push(value); } });
	if (active.length > 1) throw new Error("Multiple study logs are active; stop them before continuing.");
	return active[0] ?? null;
}

export function requireStudy(pi: ExtensionAPI, kind?: StudyKind): StudyContext {
	const active = activeStudy(pi);
	if (!active) throw new Error("An active setup or lesson log is required. Start the appropriate log before asking questions or writing study files.");
	if (kind && active.kind !== kind) throw new Error(`An active ${kind} log is required; the current log is ${active.kind}.`);
	if (linkedRoot(pi) !== active.root) throw new Error("The linked folder no longer matches the active study log.");
	active.check();
	if (active.completed) throw new Error("This study log is completed. Stop it before starting another workflow.");
	return active;
}

export function sameStudy(pi: ExtensionAPI, expected: StudyContext): StudyContext {
	if (requireStudy(pi) !== expected) throw new Error("The active study log changed during this operation.");
	return expected;
}

export function studyPath(root: string, relative: string): string {
	if (!relative || relative.includes("\\") || relative.includes(":") || relative.startsWith("/")) throw new Error("Use a relative path under the linked root with forward slashes.");
	const parts = relative.split("/");
	if (parts.some(part => !part || part === "." || part === ".." || part.startsWith(".") || /[<>"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part))) throw new Error("Invalid or hidden study path segment.");
	const full = path.join(root, ...parts);
	if (!inside(root, full) || full === root) throw new Error("Path escapes the linked root.");
	let walk = root;
	for (const part of parts) {
		walk = path.join(walk, part);
		try { if (fs.lstatSync(walk).isSymbolicLink()) throw new Error("Symlinks are not allowed in study artifact paths."); }
		catch (error: any) { if (error?.code !== "ENOENT") throw error; }
	}
	return full;
}

export function relativeLog(active: StudyContext): string {
	return path.relative(active.root, active.file).split(path.sep).join("/");
}

export function callout(kind: string, title: string, text: string): string {
	return `> [!${kind}] ${title}\n${text.split("\n").map(line => line ? `> ${line}` : ">").join("\n")}`;
}
