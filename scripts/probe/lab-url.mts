/**
 * The lab probes' base URL (T9). LAB_URL is required and there is no default port: every session runs its own dev
 * server on its own port (BRIEF §9), so a probe must be told which one to shoot and must never fall back to a port
 * that may be another session's. Usage: LAB_URL=http://localhost:3007 pnpm lab:shots
 */

/** What went wrong with LAB_URL, or null when it is a usable http(s) base URL. */
export function labUrlProblem(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return "LAB_URL is not set";
  try {
    const { protocol } = new URL(value);
    if (protocol !== "http:" && protocol !== "https:") return `LAB_URL="${value}" is not an http(s) URL`;
  } catch {
    return `LAB_URL="${value}" is not a URL`;
  }
  return null;
}

/** The lab's base URL without a trailing slash. Exits with status 2 and a clear message when LAB_URL is missing or bad. */
export function labUrl(): string {
  const problem = labUrlProblem(process.env.LAB_URL);
  if (problem) {
    console.error(
      `[lab] ${problem}. pnpm lab:shots and pnpm lab:gpu need the base URL of a running lab ` +
        "(no default port): LAB_URL=http://localhost:<port> pnpm lab:shots",
    );
    process.exit(2);
  }
  return process.env.LAB_URL!.trim().replace(/\/+$/, "");
}
