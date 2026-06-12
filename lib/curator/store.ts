import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { DailyBatch, Preferences, Verdict } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "curator");

const DEFAULT_PREFS: Preferences = {
  tagWeights: {},
  sourceWeights: {},
  feedbackCount: 0,
  updatedAt: new Date(0).toISOString(),
};

export async function loadPreferences(): Promise<Preferences> {
  const prefs = await readJson<Preferences>(prefsPath());
  return prefs ?? DEFAULT_PREFS;
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await writeJson(prefsPath(), prefs);
}

export async function loadBatch(date: string): Promise<DailyBatch | null> {
  return readJson<DailyBatch>(batchPath(date));
}

export async function saveBatch(batch: DailyBatch): Promise<void> {
  await writeJson(batchPath(batch.date), batch);
}

export async function appendFeedbackLog(entry: {
  date: string;
  articleId: string;
  verdict: Verdict | null;
  at: string;
}): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(path.join(DATA_DIR, "feedback.jsonl"), JSON.stringify(entry) + "\n", "utf8");
}

/** JST基準の今日の日付 (YYYY-MM-DD) */
export function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function prefsPath(): string {
  return path.join(DATA_DIR, "preferences.json");
}

function batchPath(date: string): string {
  return path.join(DATA_DIR, "daily", `${date}.json`);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
