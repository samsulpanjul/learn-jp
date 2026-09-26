import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { activeStudy, validateRoot } from "../lib/study-context.ts";

/** Link a folder for this Pi process only. No files are created or changed. */
export default function folderLink(pi: ExtensionAPI) {
	let root: string | null = null;

	// Let other extensions query the process-local link without persisting it.
	pi.events.on("folder:root-request", (data) => {
		const request = data as { reply?: (root: string | null) => void };
		request.reply?.(root);
	});

	pi.registerCommand("link-folder", {
		description: "Link an existing folder for this Pi process",
		handler: async (args, ctx) => {
			if (activeStudy(pi)) { ctx.ui.notify("Stop the active study log before changing the linked folder.", "warning"); return; }
			let input = args.trim();
			if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
				input = input.slice(1, -1);
			}
			if (!input || !path.isAbsolute(input)) {
				ctx.ui.notify('Usage: /link-folder "C:/absolute/path/to/folder"', "warning");
				return;
			}

			try {
				const resolved = validateRoot(input);
				if (!fs.statSync(resolved).isDirectory()) {
				ctx.ui.notify(`Not a directory: ${resolved}`, "error");
				return;
				}
				root = resolved;
				ctx.ui.setStatus("folder-root", ctx.ui.theme.fg("accent", "📁 ") + path.basename(root));
				ctx.ui.notify(`Folder linked for this Pi process: ${root}`, "success");
			} catch (error) {
				ctx.ui.notify(`Cannot link folder: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("folder-status", {
		description: "Show the currently linked folder",
		handler: async (_args, ctx) => {
			ctx.ui.notify(root ? `Linked folder: ${root}` : "No folder linked. Use /link-folder <absolute-path>.", root ? "info" : "warning");
		},
	});

	pi.registerCommand("unlink-folder", {
		description: "Unlink the currently linked folder",
		handler: async (_args, ctx) => {
			if (activeStudy(pi)) { ctx.ui.notify("Stop the active study log before unlinking its folder.", "warning"); return; }
			root = null;
			ctx.ui.setStatus("folder-root", undefined);
			ctx.ui.notify("Folder unlinked", "info");
		},
	});

	// Skills/agents can discover the active root without guessing from the cwd.
	pi.registerTool({
		name: "folder_root",
		label: "Folder root",
		description: "Return the folder linked via /link-folder. Read-only; does not start setup or create files. Call before accessing folder data.",
		parameters: Type.Object({}),
		async execute() {
			return {
				content: [{ type: "text" as const, text: root ? `Linked folder: ${root}` : "No folder linked. Ask the user to run /link-folder <absolute-path> first." }],
				details: { root, linked: root !== null },
			};
		},
	});
}
