import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { askMultipleChoice } from "./formats/multiple-choice.ts";
import { askFreeText } from "./formats/free-text.ts";
import { askSentenceOrder } from "./formats/sentence-order.ts";
import { callout, requireStudy, sameStudy, type CapturedQuestion } from "../../lib/study-context.ts";

const params = Type.Object({
	kind: Type.Union([Type.Literal("multiple_choice"), Type.Literal("free_text"), Type.Literal("sentence_order")], {
		description: "Question format: multiple_choice, free_text, or sentence_order (select fragments in sequence).",
	}),
	question: Type.String({ description: "One complete question shown to the user." }),
	options: Type.Optional(Type.Array(Type.String(), {
		description: "Required for multiple_choice: exactly four plain answer texts, without numbering or letter prefixes. Not used otherwise.",
	})),
	pieces: Type.Optional(Type.Array(Type.String(), {
		description: "Required for sentence_order: 2–8 shuffled sentence fragments in display order. Avoid ambiguous arrangements.",
	})),
});

// Serialize against ask_user_question and quiz: only one terminal popup at a time.
const LOCK_KEY = "__piSharedUiLock";
function withUILock<T>(fn: () => Promise<T>): Promise<T> {
	const global = globalThis as any;
	if (!global[LOCK_KEY]) {
		let chain: Promise<void> = Promise.resolve();
		global[LOCK_KEY] = {
			withLock<R>(operation: () => Promise<R>): Promise<R> {
				const previous = chain;
				let release!: () => void;
				chain = new Promise<void>(resolve => { release = resolve; });
				return previous.then(operation).finally(() => release());
			},
		};
	}
	return global[LOCK_KEY].withLock(fn);
}

/** One ungraded question per call; the agent chooses the next after this answer. */
export default function questions(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_question",
		label: "Ask question",
		description: "Ask ONE ungraded assessment question: multiple-choice, free-text, or sentence_order (select fragments interactively). The user may choose 'I don't know'. Returns the answer for choosing the next question, but never reveals correctness or an answer key. Do not provide feedback until the entire assessment round is complete. Requires an active setup/session log for persistent recording.",
		parameters: params,
		async execute(_id, input, signal, _onUpdate, ctx) {
			const question = input.question.trim();
			if (!question) throw new Error("Question cannot be empty.");
			const options = input.kind === "multiple_choice" ? (input.options ?? []).map((o: string) => o.trim()) : [];
			const pieces = input.kind === "sentence_order" ? (input.pieces ?? []).map((p: string) => p.trim()) : [];
			if (input.kind === "multiple_choice" && (options.length !== 4 || options.some((o: string) => !o))) {
				throw new Error("multiple_choice requires exactly four nonempty plain answer texts.");
			}
			if (input.kind === "sentence_order" && (pieces.length < 2 || pieces.length > 8 || pieces.some((p: string) => !p))) {
				throw new Error("sentence_order requires 2–8 nonempty shuffled fragments.");
			}
			if (signal?.aborted) return { content: [{ type: "text" as const, text: "Question cancelled." }], details: { status: "cancelled", kind: input.kind, question, options, pieces } };
			if (!ctx.hasUI) throw new Error("ask_question requires interactive UI.");
			const session = requireStudy(pi);
			return withUILock(async () => {
				sameStudy(pi, session);
				if (session.busy) throw new Error("Another study operation is still running.");
				if (signal?.aborted) throw new Error("Question cancelled before display.");
				session.busy = true;
				try {
					const questionNumber = session.questions.length + 1;
					const captured: CapturedQuestion = { id: _id, kind: input.kind, question, options, pieces, askedAt: new Date().toISOString(), status: "pending" };
					const choices = input.kind === "multiple_choice" ? options.map((text, i) => `${"ABCD"[i]}. ${text}`) : input.kind === "sentence_order" ? pieces.map((text, i) => `${"ABCDEFGH"[i]}. ${text}`) : ["Enter answer"];
					session.append(callout("question", `Question ${questionNumber} — ${captured.askedAt}`, [question, ...choices, "I don't know"].join("\n")));
					session.questions.push(captured);
					const result = input.kind === "multiple_choice"
						? await askMultipleChoice(ctx, question, options)
						: input.kind === "sentence_order"
							? await askSentenceOrder(ctx, question, pieces)
							: await askFreeText(ctx, question);
					captured.answeredAt = new Date().toISOString();
					Object.assign(captured, result);
					try {
						sameStudy(pi, session);
						const answer = result.status === "cancelled" ? "(cancelled)" : "order" in result ? `Order: ${(result.order as number[]).join(" → ")}\n${result.answer}` : result.answer;
						session.append(callout("example", `Answer ${questionNumber} — ${captured.answeredAt}`, answer));
					} catch (error) {
						session.fail(error);
						throw new Error(`${String(error)}\nSubmitted response (not safely logged): ${JSON.stringify(result)}`);
					}
					if (result.status === "cancelled") {
						return { content: [{ type: "text" as const, text: "Question cancelled." }], details: { status: "cancelled", kind: input.kind, question, options, pieces } };
					}
					const selection = "choiceIndex" in result ? `${"ABCD"[result.choiceIndex! - 1]}. ${result.answer}` : result.answer;
					return {
						content: [{ type: "text" as const, text: result.dontKnow ? 'User selected "I don\'t know". No answer attempted. Do not reveal correctness yet.' : `User answered: ${selection}\nDo not reveal correctness yet.` }],
						details: { ...captured },
					};
				} finally { session.busy = false; }
			});
		},
	});
}
