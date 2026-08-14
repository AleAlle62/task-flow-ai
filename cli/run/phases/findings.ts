/**
 * Whether a review phase reported something serious enough to send the work
 * back.
 *
 * The signal is the severity label the phase prompts ask for — `[blocking]`,
 * `[critical]` and so on. It is a convention rather than a format, so a phase
 * that stops using the labels stops triggering loops: that is why the prompts
 * spell the labels out, and why changing them means changing both.
 */
export function hasFindings(artifact: string, severities: string[]): boolean {
  if (severities.length === 0) return false;

  const escaped = severities.map((severity) => severity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return new RegExp(`\\[(${escaped.join("|")})\\]`, "i").test(artifact);
}
