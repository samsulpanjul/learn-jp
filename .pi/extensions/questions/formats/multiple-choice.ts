export type Response =
	| { status: "answered"; answer: string; choiceIndex?: number; dontKnow: boolean }
	| { status: "cancelled" };

/** Only gathers an answer. Grading is deliberately outside this UI. */
export async function askMultipleChoice(ctx: any, question: string, options: string[]): Promise<Response> {
	const labels = options.map((label, index) => `${"ABCD"[index]}. ${label}`);
	const unknown = "I don't know";
	const selected = await ctx.ui.select(question, [...labels, unknown]);
	if (selected === undefined) return { status: "cancelled" };
	if (selected === unknown) return { status: "answered", answer: unknown, dontKnow: true };
	const index = labels.indexOf(selected);
	if (index < 0) throw new Error("Unexpected multiple-choice selection.");
	return { status: "answered", answer: options[index], choiceIndex: index + 1, dontKnow: false };
}
