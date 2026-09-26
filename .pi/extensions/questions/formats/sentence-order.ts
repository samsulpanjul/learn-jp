import type { Response } from "./multiple-choice.ts";

/** Choose fragments interactively; no typed index sequence or immediate grading. */
export async function askSentenceOrder(ctx: any, question: string, pieces: string[]): Promise<Response & { order?: number[] }> {
	const order: number[] = [];
	const letters = "ABCDEFGH";

	while (true) {
		const remaining = pieces.map((_, index) => index).filter(index => !order.includes(index));
		const current = order.length ? order.map(index => pieces[index]).join(" ") : "(empty)";
		const title = `${question}\n\nYour sentence: ${current}\nSelect the next fragment:`;
		const choices = remaining.map(index => `${letters[index]}. ${pieces[index]}`);
		if (order.length) choices.push("Undo", "Reset");
		if (!remaining.length) choices.push("Submit");
		choices.push("I don't know");
		const selected = await ctx.ui.select(title, choices);
		if (selected === undefined) return { status: "cancelled" };
		if (selected === "I don't know") return { status: "answered", answer: selected, dontKnow: true };
		if (selected === "Undo") { order.pop(); continue; }
		if (selected === "Reset") { order.length = 0; continue; }
		if (selected === "Submit") {
			if (order.length !== pieces.length) throw new Error("Incomplete sentence order.");
			return { status: "answered", answer: order.map(index => pieces[index]).join(" "), order: order.map(index => index + 1), dontKnow: false };
		}
		const index = remaining.find(index => selected === `${letters[index]}. ${pieces[index]}`);
		if (index === undefined) throw new Error("Unexpected fragment selection.");
		order.push(index);
	}
}
