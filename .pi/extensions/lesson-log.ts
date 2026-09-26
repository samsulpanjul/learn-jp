import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerStudyLog } from "../lib/study-log.ts";

export default function lessonLog(pi: ExtensionAPI) {
	registerStudyLog(pi, "lesson");
}
