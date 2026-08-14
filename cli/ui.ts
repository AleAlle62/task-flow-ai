const useColor = process.stdout.isTTY === true && !process.env["NO_COLOR"];

const paint = (code: string) => (text: string) =>
  useColor ? `[${code}m${text}[0m` : text;

export const dim = paint("2");
export const bold = paint("1");
export const green = paint("32");
export const red = paint("31");
export const amber = paint("33");
export const blue = paint("34");

export function line(text = ""): void {
  process.stdout.write(`${text}\n`);
}

export function phaseStarted(index: number, total: number, id: string): void {
  line();
  line(`${blue("▸")} ${bold(id)} ${dim(`(${index + 1}/${total})`)}`);
}

export function phaseFinished(output: string, seconds: number, costUsd?: number): void {
  const price = costUsd !== undefined && costUsd > 0 ? ` · $${costUsd.toFixed(4)}` : "";
  line(`${green("✓")} ${dim(`${output} · ${seconds.toFixed(1)}s${price}`)}`);
}

export function phaseFailed(reason: string): void {
  line(`${red("✗")} ${reason}`);
}
