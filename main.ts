import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type WordProfile = {
  word: string;
  surprise: number;
  vividness: number;
  wit: number;
  chosenness: number;
  familiarity: number;
  sound: number;
  onomatopoeia?: number;
  doubleMeaning?: number;
  rarity?: number;
};

type RankedWord = WordProfile & { score: number };

type GateResult = { ok: true } | { ok: false; reason: string };

type WriteOutcome = { path: string; word: string; bytes: number };

type CliOptions = {
  dryRun: boolean;
  explain: boolean;
  selfTest: boolean;
  help: boolean;
};

const ENTRY_MAX_CHARS = 24;
const ENTRY_MIN_CHARS = 1;
const DEFAULT_WORD = "lambent";

const FILLER_WORDS = new Set([
  "thing",
  "stuff",
  "word",
  "nice",
  "good",
  "cool",
  "okay",
  "ok",
  "yes",
  "no",
  "maybe",
  "interesting",
  "random",
  "whatever",
  "something",
  "anything",
  "nothing",
  "very",
  "really",
  "just",
  "basically",
  "literally",
  "actually",
]);

const GENERIC_SUFFIXES = [
  "ness",
  "ment",
  "tion",
  "sion",
  "able",
  "ible",
  "less",
  "ings",
  "ing",
  "ers",
  "er",
  "ly",
];

const CANDIDATES: WordProfile[] = [
  { word: "lambent", surprise: 5, vividness: 4, wit: 5, chosenness: 5, familiarity: 2, sound: 4.5 },
  { word: "apricity", surprise: 5, vividness: 5, wit: 2.5, chosenness: 5, familiarity: 1, sound: 4.5 },
  { word: "petrichor", surprise: 4, vividness: 5, wit: 2.5, chosenness: 5, familiarity: 3, sound: 4.5 },
  { word: "susurrus", surprise: 5, vividness: 4, wit: 4.5, chosenness: 5, familiarity: 2, sound: 5 },
  { word: "defenestrate", surprise: 4.5, vividness: 5, wit: 5, chosenness: 5, familiarity: 4, sound: 3.5 },
  { word: "vellichor", surprise: 5, vividness: 5, wit: 4, chosenness: 4, familiarity: 2, sound: 4.5 },
  { word: "sonder", surprise: 4, vividness: 5, wit: 3.5, chosenness: 4, familiarity: 3.5, sound: 4 },
  { word: "halcyon", surprise: 4, vividness: 4, wit: 4.5, chosenness: 5, familiarity: 2.5, sound: 4.5 },
  { word: "mellifluous", surprise: 3.5, vividness: 4, wit: 4, chosenness: 5, familiarity: 3, sound: 5 },
  { word: "crepuscular", surprise: 4, vividness: 5, wit: 2, chosenness: 5, familiarity: 2.5, sound: 4 },
  { word: "phosphorescence", surprise: 3.5, vividness: 4.5, wit: 2.5, chosenness: 4.5, familiarity: 3, sound: 4 },
  { word: "scintilla", surprise: 4, vividness: 4, wit: 4, chosenness: 5, familiarity: 3, sound: 4 },
  { word: "obliviscence", surprise: 5, vividness: 4, wit: 3, chosenness: 4, familiarity: 1.5, sound: 4 },
  { word: "nemophilist", surprise: 5, vividness: 4, wit: 2.5, chosenness: 4, familiarity: 1.5, sound: 3.5 },
  { word: "sillage", surprise: 4.5, vividness: 4.5, wit: 3, chosenness: 4.5, familiarity: 2, sound: 4.5 },
  { word: "limerence", surprise: 4, vividness: 5, wit: 2.5, chosenness: 4, familiarity: 3, sound: 4 },
  { word: "quixotic", surprise: 4, vividness: 4, wit: 4, chosenness: 5, familiarity: 3, sound: 4 },
  { word: "ephemeral", surprise: 3, vividness: 4, wit: 3, chosenness: 5, familiarity: 4, sound: 4.5 },
  { word: "ineffable", surprise: 3.5, vividness: 4, wit: 3, chosenness: 5, familiarity: 3.5, sound: 4.5 },
  { word: "gossamer", surprise: 3.5, vividness: 5, wit: 3, chosenness: 5, familiarity: 2.5, sound: 4.5 },
  { word: "zephyr", surprise: 4, vividness: 4, wit: 3, chosenness: 4.5, familiarity: 3, sound: 4.5 },
  { word: "crepuscule", surprise: 5, vividness: 4, wit: 2.5, chosenness: 4, familiarity: 1.5, sound: 4 },
  { word: "scintillate", surprise: 3, vividness: 4, wit: 3.5, chosenness: 4.5, familiarity: 2.5, sound: 4 },
  { word: "murmuration", surprise: 3.5, vividness: 5, wit: 3, chosenness: 4.5, familiarity: 2.5, sound: 4.5 },
  { word: "pyrrhic", surprise: 4, vividness: 4, wit: 4, chosenness: 4.5, familiarity: 3.5, sound: 4 },
  { word: "serendipity", surprise: 2.5, vividness: 4, wit: 3, chosenness: 5, familiarity: 4, sound: 4.5 },
  { word: "susurration", surprise: 4.5, vividness: 4, wit: 3.5, chosenness: 4, familiarity: 2, sound: 4.5 },
  { word: "labyrinthine", surprise: 3.5, vividness: 4.5, wit: 3.5, chosenness: 4.5, familiarity: 3, sound: 4 },
  { word: "incandescent", surprise: 3, vividness: 5, wit: 3, chosenness: 4.5, familiarity: 3.5, sound: 4 },
  { word: "woebegone", surprise: 4, vividness: 4.5, wit: 3, chosenness: 4.5, familiarity: 2.5, sound: 3.5 },
  { word: "gloaming", surprise: 4, vividness: 5, wit: 4, chosenness: 5, familiarity: 2.5, sound: 4.5, doubleMeaning: 3 },
  { word: "coruscate", surprise: 5, vividness: 4.5, wit: 3.5, chosenness: 5, familiarity: 1.5, sound: 4, rarity: 4 },
  { word: "nacreous", surprise: 5, vividness: 5, wit: 3, chosenness: 4.5, familiarity: 1.5, sound: 4.5, rarity: 3.5 },
  { word: "widdershins", surprise: 5, vividness: 4, wit: 5, chosenness: 5, familiarity: 2, sound: 4.5, doubleMeaning: 3, rarity: 4 },
  { word: "snickersnee", surprise: 5, vividness: 4.5, wit: 5, chosenness: 4.5, familiarity: 1, sound: 5, onomatopoeia: 3, rarity: 4 },
  { word: "solivagant", surprise: 5, vividness: 4.5, wit: 3.5, chosenness: 4.5, familiarity: 1, sound: 4, rarity: 4 },
  { word: "quiddity", surprise: 4.5, vividness: 3.5, wit: 5, chosenness: 4.5, familiarity: 1.5, sound: 4, doubleMeaning: 4 },
  { word: "numinous", surprise: 4.5, vividness: 4.5, wit: 3.5, chosenness: 5, familiarity: 2, sound: 4.5 },
  { word: "liminal", surprise: 3.5, vividness: 4, wit: 4, chosenness: 4.5, familiarity: 3.5, sound: 4.5 },
  { word: "tsundoku", surprise: 4.5, vividness: 5, wit: 4, chosenness: 4.5, familiarity: 2, sound: 4, rarity: 4 },
  { word: "komorebi", surprise: 5, vividness: 5, wit: 3.5, chosenness: 4.5, familiarity: 2, sound: 4.5, rarity: 4 },
  { word: "saudade", surprise: 4, vividness: 5, wit: 3.5, chosenness: 4.5, familiarity: 2.5, sound: 4.5, rarity: 3 },
  { word: "meraki", surprise: 4, vividness: 4.5, wit: 3.5, chosenness: 4.5, familiarity: 2, sound: 4.5, rarity: 3 },
  { word: "cerulean", surprise: 3.5, vividness: 5, wit: 3.5, chosenness: 4.5, familiarity: 3, sound: 4.5 },
  { word: "gambol", surprise: 4, vividness: 4.5, wit: 4.5, chosenness: 4.5, familiarity: 2, sound: 4.5 },
  { word: "kerfuffle", surprise: 3.5, vividness: 4, wit: 5, chosenness: 4.5, familiarity: 3.5, sound: 5, onomatopoeia: 4 },
  { word: "hullabaloo", surprise: 3.5, vividness: 4, wit: 4.5, chosenness: 4, familiarity: 3.5, sound: 4.5, onomatopoeia: 4 },
  { word: "moxie", surprise: 3.5, vividness: 4, wit: 4.5, chosenness: 4, familiarity: 3.5, sound: 4 },
];

const FALLBACKS = ["lambent", "petrichor", "apricity"];

const WORD_PATTERN = /^[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*$/u;

function isStrippableCodePoint(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x00ad ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x206f) ||
    code === 0xfeff
  );
}

function sanitizeWord(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let cleaned = "";
  for (const ch of raw.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isStrippableCodePoint(code)) cleaned += ch;
  }
  return cleaned.trim();
}

function codePointLength(word: string): number {
  let count = 0;
  for (const _ch of word) count += 1;
  return count;
}

function utf8Bytes(word: string): number {
  return Buffer.byteLength(word, "utf8");
}

function isPlainSingleWord(word: string): boolean {
  if (word.length === 0) return false;
  const points = codePointLength(word);
  if (points < ENTRY_MIN_CHARS || points > ENTRY_MAX_CHARS) return false;
  if (Array.from(word).some((ch) => /\s/u.test(ch))) return false;
  if (!WORD_PATTERN.test(word)) return false;
  if (!/\p{L}/u.test(word)) return false;
  return true;
}

function isAcceptableWord(word: string): boolean {
  return isPlainSingleWord(word) && !FILLER_WORDS.has(word.toLowerCase());
}

function validateGate(word: string): GateResult {
  if (typeof word !== "string" || word.length === 0) {
    return { ok: false, reason: "entry is empty" };
  }
  if (Buffer.from(word, "utf8").toString("utf8") !== word) {
    return { ok: false, reason: "entry is not valid UTF-8 text" };
  }
  const points = codePointLength(word);
  if (points < ENTRY_MIN_CHARS || points > ENTRY_MAX_CHARS) {
    return { ok: false, reason: `entry must be ${ENTRY_MIN_CHARS} to ${ENTRY_MAX_CHARS} characters` };
  }
  if (word.trim().length === 0) {
    return { ok: false, reason: "entry is only white space" };
  }
  if (!isPlainSingleWord(word)) {
    return { ok: false, reason: "entry is not exactly one plain word" };
  }
  return { ok: true };
}

function lengthPenalty(word: string): number {
  const n = codePointLength(word);
  if (n <= 2) return -0.5;
  if (n <= 10) return 0;
  if (n <= 12) return -0.15 * (n - 10);
  return -0.3 - 0.35 * (n - 12);
}

function genericPenalty(word: string): number {
  const lower = word.toLowerCase();
  let penalty = 0;
  if (FILLER_WORDS.has(lower)) penalty += 4;
  if (GENERIC_SUFFIXES.some((suffix) => lower.endsWith(suffix) && lower.length > suffix.length + 2)) {
    penalty += 0.35;
  }
  const letters = Array.from(lower).filter((ch) => /[a-z]/u.test(ch));
  if (letters.length > 0 && new Set(letters).size <= 3) {
    penalty += 0.4;
  }
  return penalty;
}

function textureScore(word: string): number {
  const chars = Array.from(word.toLowerCase()).filter((ch) => /\p{L}/u.test(ch));
  if (chars.length === 0) return 0;
  const vowels = chars.filter((ch) => /[aeiouy]/u.test(ch)).length;
  const vowelShare = vowels / chars.length;
  const balance = 1 - Math.abs(vowelShare - 0.42);
  const sibilance = chars.filter((ch) => /[szʃʒ]/u.test(ch)).length;
  const liquids = chars.filter((ch) => /[lmnr]/u.test(ch)).length;
  const plosives = chars.filter((ch) => /[bdgkpt]/u.test(ch)).length;
  const rare = chars.filter((ch) => /[jqxzvkw]/u.test(ch)).length;
  const counts = new Map<string, number>();
  for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let repeatPenalty = 0;
  for (const count of counts.values()) {
    if (count > 2) repeatPenalty += 0.04 * (count - 2);
  }
  let transitions = 0;
  for (let index = 1; index < chars.length; index += 1) {
    const previousVowel = /[aeiouy]/u.test(chars[index - 1]);
    const currentVowel = /[aeiouy]/u.test(chars[index]);
    if (previousVowel !== currentVowel) transitions += 1;
  }
  const alternation = chars.length > 1 ? transitions / (chars.length - 1) : 0;
  const bonus =
    0.18 * Math.max(0, balance) +
    0.08 * Math.min(sibilance, 3) +
    0.07 * Math.min(liquids, 3) +
    0.05 * Math.min(plosives, 2) +
    0.06 * Math.min(rare, 2) +
    0.08 * alternation -
    repeatPenalty;
  return Math.max(0, Math.min(0.8, bonus));
}

function scoreCandidate(profile: WordProfile): number {
  const base =
    1.7 * profile.surprise +
    1.45 * profile.vividness +
    1.25 * profile.wit +
    1.1 * profile.chosenness +
    0.35 * profile.sound -
    0.3 * profile.familiarity +
    0.18 * (profile.onomatopoeia ?? 0) +
    0.12 * (profile.doubleMeaning ?? 0) +
    0.1 * (profile.rarity ?? 0);
  return base + lengthPenalty(profile.word) - genericPenalty(profile.word) + textureScore(profile.word);
}

function stableHash(word: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < word.length; index += 1) {
    hash ^= word.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function rankCandidates(candidates: readonly WordProfile[]): RankedWord[] {
  const best = new Map<string, WordProfile>();
  for (const candidate of candidates) {
    const word = sanitizeWord(candidate.word);
    if (!isAcceptableWord(word)) continue;
    const key = word.toLowerCase();
    const profile: WordProfile = { ...candidate, word };
    const previous = best.get(key);
    if (!previous || scoreCandidate(profile) > scoreCandidate(previous)) {
      best.set(key, profile);
    }
  }
  return Array.from(best.values())
    .map((profile) => ({ ...profile, score: Number(scoreCandidate(profile).toFixed(6)) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.word.length !== b.word.length) return a.word.length - b.word.length;
      const hashOrder = stableHash(a.word) - stableHash(b.word);
      if (hashOrder !== 0) return hashOrder;
      return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
    });
}

function selectEntryWord(): string {
  const ranked = rankCandidates(CANDIDATES);
  for (const candidate of ranked) {
    if (validateGate(candidate.word).ok) return candidate.word;
  }
  for (const fallback of FALLBACKS) {
    const word = sanitizeWord(fallback);
    if (validateGate(word).ok) return word;
  }
  return DEFAULT_WORD;
}

function normalizeOutput(word: string): string {
  const cleaned = sanitizeWord(word);
  if (validateGate(cleaned).ok) return cleaned;
  return DEFAULT_WORD;
}

function formatRanking(limit: number): string {
  const ranked = rankCandidates(CANDIDATES).slice(0, Math.max(1, limit));
  const lines = ranked.map((entry, index) => {
    const place = String(index + 1).padStart(2, " ");
    return `${place}. ${entry.word.padEnd(14, " ")} ${entry.score.toFixed(3)}`;
  });
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { dryRun: false, explain: false, selfTest: false, help: false };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--explain") options.explain = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
  }
  return options;
}

function runSelfTests(): string[] {
  const failures: string[] = [];
  const expect = (condition: boolean, message: string): void => {
    if (!condition) failures.push(message);
  };
  expect(isPlainSingleWord("lambent"), "a normal word must be accepted");
  expect(!isPlainSingleWord("two words"), "whitespace must be rejected");
  expect(!isPlainSingleWord(""), "an empty word must be rejected");
  expect(!isPlainSingleWord("a".repeat(ENTRY_MAX_CHARS + 1)), "an overlong word must be rejected");
  expect(isPlainSingleWord("a".repeat(ENTRY_MAX_CHARS)), "a word at the length cap must be accepted");
  expect(!isAcceptableWord("thing"), "filler words must be rejected");
  expect(sanitizeWord("  lambent\u200b ") === "lambent", "invisible characters must be stripped");
  expect(validateGate("lambent").ok, "a valid word must pass the gate");
  expect(!validateGate("   ").ok, "white space must not pass the gate");
  expect(codePointLength("café") === 4, "code points must be counted correctly");
  expect(utf8Bytes("café") === 5, "UTF-8 byte counts must be correct");
  const ranked = rankCandidates(CANDIDATES);
  expect(ranked.length > 0, "the ranking must not be empty");
  expect(ranked.every((entry) => validateGate(entry.word).ok), "every ranked word must pass the gate");
  expect(new Set(ranked.map((entry) => entry.word.toLowerCase())).size === ranked.length, "ranked words must be unique");
  const selected = selectEntryWord();
  expect(validateGate(selected).ok, "the selected word must pass the gate");
  expect(utf8Bytes(selected) <= ENTRY_MAX_CHARS * 4, "the selected word must stay within the byte budget");
  expect(ranked.every((entry, index) => index === 0 || ranked[index - 1].score >= entry.score), "the ranking must be ordered");
  expect(stableHash("lambent") === stableHash("lambent"), "the tie-break hash must be deterministic");
  expect(normalizeOutput("two words") === DEFAULT_WORD, "invalid output must fall back to the default word");
  expect(normalizeOutput("  lambent  ") === "lambent", "normalization must trim surrounding space");
  expect(lengthPenalty("ab") < 0, "very short words must be penalized");
  expect(lengthPenalty("lambent") === 0, "mid-length words must not be penalized");
  expect(lengthPenalty("a".repeat(20)) < lengthPenalty("a".repeat(13)), "the length penalty must grow");
  const duplicated = rankCandidates([...CANDIDATES, { ...CANDIDATES[0], word: "LAMBENT" }]);
  expect(duplicated.filter((entry) => entry.word.toLowerCase() === "lambent").length === 1, "case variants must dedupe");
  return failures;
}

async function verifyEntryFile(filePath: string, expected: string): Promise<void> {
  const written = await readFile(filePath, "utf8");
  if (written !== expected) throw new Error(`entry verification failed: ${filePath}`);
  const gate = validateGate(written);
  if (!gate.ok) throw new Error(`entry verification failed: ${gate.reason}`);
  if (utf8Bytes(written) !== utf8Bytes(expected)) throw new Error("entry byte count mismatch");
}

async function writeEntry(word: string): Promise<WriteOutcome> {
  const target = normalizeOutput(word);
  const attempts = [join("/", "output", "entry.txt"), join(process.cwd(), "output", "entry.txt")];
  let lastError: unknown = null;
  for (const filePath of attempts) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, target, { encoding: "utf8" });
        await verifyEntryFile(filePath, target);
        return { path: filePath, word: target, bytes: utf8Bytes(target) };
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("could not write entry");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("usage: node main.ts [--dry-run] [--explain] [--self-test] [--help]\n");
    return;
  }
  if (options.selfTest) {
    const failures = runSelfTests();
    if (failures.length > 0) {
      for (const failure of failures) process.stderr.write(`self-test failed: ${failure}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write("self-test: all checks passed\n");
    return;
  }
  const word = selectEntryWord();
  const gate = validateGate(word);
  if (!gate.ok) throw new Error(`selected word failed the gate: ${gate.reason}`);
  if (options.explain) process.stdout.write(formatRanking(8));
  if (options.dryRun) {
    process.stdout.write(`entry: ${word} (${codePointLength(word)} chars, ${utf8Bytes(word)} bytes) [dry run]\n`);
    return;
  }
  const outcome = await writeEntry(word);
  process.stdout.write(
    `entry: ${outcome.word} (${codePointLength(outcome.word)} chars, ${outcome.bytes} bytes) -> ${outcome.path}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
