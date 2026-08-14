import type { Phase } from "../../model/types.js";
import { resolveInput, type InputBlock } from "./sources.js";
import type { RunStore } from "../store/store.js";

/** The artifact that sent the work back, and which phase sent it. */
export interface Correction {
  fromPhase: string;
  artifact: string;
  content: string;
}

/**
 * Composes the message a phase receives: the contents of everything it is
 * entitled to read, and nothing else.
 *
 * Contents are pasted in rather than referenced by path. It costs a few
 * kilobytes and it means a phase can run on a provider with no way to open a
 * file at all — the difference between supporting any agent and supporting the
 * agents that happen to have a filesystem.
 */
export function buildPhaseInput(
  phase: Phase,
  store: RunStore,
  projectDir: string,
  correction?: Correction,
): string {
  const blocks = phase.inputs
    .map((name) => resolveInput(name, phase, store, projectDir))
    .filter((block): block is InputBlock => block !== undefined);

  if (correction) blocks.push({ name: correction.artifact, content: correction.content });

  return [
    `You are running the "${phase.id}" phase of a pipeline.`,
    ``,
    `Below is everything the phases before you produced. Nothing else is`,
    `available to you: if something you need is missing, say so in your output`,
    `instead of inventing it.`,
    ``,
    ...blocks.map(render),
    ...(correction ? ["", correctionNotice(correction)] : []),
    ``,
    `Write the content of \`${phase.output}\` and nothing else. No preamble, no`,
    `closing summary, no commentary about the pipeline.`,
  ].join("\n");
}

function render({ name, content }: InputBlock): string {
  return `<input name="${name}">\n${content.trim()}\n</input>`;
}

function correctionNotice(correction: Correction): string {
  return [
    `This is a correction pass. The "${correction.fromPhase}" phase found problems`,
    `it considers blocking, listed in ${correction.artifact} above.`,
    ``,
    `Fix those findings and nothing else. Do not take the opportunity to improve`,
    `unrelated code, and do not redesign the approved plan around them.`,
  ].join("\n");
}
