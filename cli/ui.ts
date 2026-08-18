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
