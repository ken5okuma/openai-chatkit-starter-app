import { spawn } from "node:child_process";

const CLAUDE_TIMEOUT_MS = 120_000;

let cliAvailable: boolean | null = null;

/** Claude Code CLI がインストールされているか(初回チェック結果をキャッシュ) */
export async function isClaudeCliAvailable(): Promise<boolean> {
  if (cliAvailable !== null) return cliAvailable;
  try {
    await runCommand("claude", ["--version"], "", 10_000);
    cliAvailable = true;
  } catch {
    cliAvailable = false;
  }
  return cliAvailable;
}

/**
 * Claude Code のheadlessモード(claude -p)でプロンプトを実行する。
 * Proプランのサブスクリプション認証で動くため、APIキーは不要。
 * CURATOR_CLAUDE_MODEL でモデルを指定可能(例: haiku で利用枠を節約)。
 */
export async function runClaude(prompt: string): Promise<string> {
  const args = ["-p", "--output-format", "text"];
  const model = process.env.CURATOR_CLAUDE_MODEL;
  if (model) args.push("--model", model);
  return runCommand("claude", args, prompt, CLAUDE_TIMEOUT_MS);
}

function runCommand(
  cmd: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${cmd} exited with ${code}: ${stderr.slice(0, 500)}`));
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}
