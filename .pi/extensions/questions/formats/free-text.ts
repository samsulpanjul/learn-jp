import type { Response } from "./multiple-choice.ts";

/** The opt-out is explicit; an empty response is not silently treated as 'I don't know'. */
export async function askFreeText(ctx: any, question: string): Promise<Response> {
	const action = await ctx.ui.select(question, ["Enter answer", "I don't know"]);
	if (action === undefined) return { status: "cancelled" };
	if (action === "I don't know") return { status: "answered", answer: action, dontKnow: true };
	while (true) {
		const answer = await ctx.ui.editor(question);
		if (answer === undefined) return { status: "cancelled" };
		if (answer.trim()) return { status: "answered", answer: answer.trim(), dontKnow: false };
		ctx.ui.notify("Enter an answer or cancel.", "warning");
	}
}
