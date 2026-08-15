import type { Phase } from "../model/types.js";
import { amber, blue, bold, dim, green, line, red } from "../ui.js";

/**
 * Everything a run says out loud, in one place.
 *
 * The orchestrator decides what happens; this decides how it reads. Keeping
 * them apart is why the rules elsewhere can be understood without a terminal,
 * and why changing the wording never risks changing the behaviour.
 */

export function phaseStarting(index: number, total: number, id: string): void {
  line();
  line(`${blue("▸")} ${bold(id)} ${dim(`(${index + 1}/${total})`)}`);
}

export function phaseDone(output: string, durationMs: number, costUsd?: number): void {
  const price = costUsd !== undefined && costUsd > 0 ? ` · $${costUsd.toFixed(4)}` : "";
  line(`${green("✓")} ${dim(`${output} · ${(durationMs / 1000).toFixed(1)}s${price}`)}`);
}

export function phaseFailed(reason: string): void {
  line(`${red("✗")} ${reason}`);
}

export function phaseSkipped(id: string): void {
  line(`${dim("·")} ${dim(`${id} — already done, skipping`)}`);
}

export function providerCannotWrite(providerId: string, skipped: Phase[]): void {
  line();
  line(
    `${amber("!")} provider "${providerId}" cannot hold a phase to what it was granted, ` +
      `so ${skipped.map((phase) => phase.id).join(", ")} will not run and nothing will be written.`,
  );
  line(dim(`  You still get the specification, the exploration, the plan and the review.`));
}

export function sendingBack(from: string, to: string, round: number, of: number): void {
  line();
  line(`${amber("↩")} ${from} found blocking problems — back to ${to} ${dim(`(round ${round} of ${of})`)}`);
}

export function loopExhausted(id: string, artifact: string, rounds: number): void {
  line();
  line(
    `${amber("!")} ${id} still reports blocking findings after ${rounds} rounds. ` +
      `Stopping the loop — read ${artifact} and decide yourself.`,
  );
}

export function stopped(id: string): void {
  line();
  line(`${amber("■")} stopped at ${id}. Nothing further was written.`);
}

export function wroteOutside(id: string, files: string[], allowed: string[]): void {
  line();
  line(`${red("✗")} ${id} wrote outside the paths it was allowed to touch:`);
  for (const file of files) line(`    ${file}`);
  line(dim(`  allowed: ${allowed.join(", ")}`));
  line(dim(`  The files were left as they are. Review them before keeping them.`));
}
