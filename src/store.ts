/**
 * Persistence for the learner profile, roadmap, lessons and quiz history.
 *
 * One embedded LanceDB database holds everything: it does vector search and
 * scalar filtering in the same tables, so there is no second relational store.
 *
 * Tables are created from explicit Arrow schemas rather than inferred from the
 * first row, so an empty database has the same shape as a populated one.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import * as lancedb from "@lancedb/lancedb";
import {
  Field,
  FixedSizeList,
  Float32,
  Float64,
  Int32,
  Schema,
  Utf8,
} from "apache-arrow";
import { EMBED_DIM, embed, embedOne } from "./embed.ts";
import { initialReview, type Review } from "./schedule.ts";
import type { RoadmapNode } from "./graph.ts";

export type Profile = {
  goal: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillRow = {
  topic: string;
  level: number;
  confidence: number;
  evidence: string;
  assessedAt: string;
};

export type LessonRow = {
  id: string;
  nodeId: string;
  title: string;
  markdown: string;
  createdAt: string;
};

export type QuizRow = {
  id: string;
  nodeId: string;
  question: string;
  answerKey: string;
  response: string;
  score: number;
  askedAt: string;
};

export function dataDir(): string {
  return (
    process.env.ABY_DATA_DIR ??
    join(
      process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "aby",
    )
  );
}

function vectorField(): Field {
  return new Field(
    "vector",
    new FixedSizeList(EMBED_DIM, new Field("item", new Float32(), true)),
    true,
  );
}

const SCHEMAS: Record<string, Schema> = {
  profile: new Schema([
    new Field("id", new Utf8(), false),
    new Field("goal", new Utf8(), true),
    new Field("createdAt", new Utf8(), true),
    new Field("updatedAt", new Utf8(), true),
  ]),
  skills: new Schema([
    new Field("topic", new Utf8(), false),
    new Field("level", new Int32(), true),
    new Field("confidence", new Float64(), true),
    new Field("evidence", new Utf8(), true),
    new Field("assessedAt", new Utf8(), true),
    vectorField(),
  ]),
  nodes: new Schema([
    new Field("id", new Utf8(), false),
    new Field("title", new Utf8(), true),
    new Field("summary", new Utf8(), true),
    // JSON-encoded string[]; avoids Arrow list handling for a field we only
    // ever read and write whole.
    new Field("prereqs", new Utf8(), true),
    new Field("mastery", new Float64(), true),
    new Field("reps", new Int32(), true),
    new Field("ease", new Float64(), true),
    new Field("intervalDays", new Float64(), true),
    // "" means "never scheduled"; keeps the column non-null and simple to filter.
    new Field("dueAt", new Utf8(), true),
    new Field("updatedAt", new Utf8(), true),
    vectorField(),
  ]),
  lessons: new Schema([
    new Field("id", new Utf8(), false),
    new Field("nodeId", new Utf8(), true),
    new Field("title", new Utf8(), true),
    new Field("markdown", new Utf8(), true),
    new Field("createdAt", new Utf8(), true),
    vectorField(),
  ]),
  quiz: new Schema([
    new Field("id", new Utf8(), false),
    new Field("nodeId", new Utf8(), true),
    new Field("question", new Utf8(), true),
    new Field("answerKey", new Utf8(), true),
    new Field("response", new Utf8(), true),
    new Field("score", new Float64(), true),
    new Field("askedAt", new Utf8(), true),
    vectorField(),
  ]),
};

let dbPromise: Promise<lancedb.Connection> | undefined;
let currentDir: string | undefined;

async function db(): Promise<lancedb.Connection> {
  const dir = dataDir();
  // Tests point ABY_DATA_DIR at a temp directory; reconnect if it changed.
  if (!dbPromise || currentDir !== dir) {
    currentDir = dir;
    dbPromise = lancedb.connect(dir);
  }
  return dbPromise;
}

/** Drop the cached connection. Only needed when tests swap data directories. */
export function resetConnection(): void {
  dbPromise = undefined;
  currentDir = undefined;
}

async function table(name: keyof typeof SCHEMAS): Promise<lancedb.Table> {
  const conn = await db();
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`unknown table ${name}`);
  return conn.createEmptyTable(name, schema, {
    mode: "create",
    existOk: true,
  });
}

async function upsert(
  name: keyof typeof SCHEMAS,
  key: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const t = await table(name);
  await t
    .mergeInsert(key)
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute(rows);
}

const ZERO_VECTOR = new Array<number>(EMBED_DIM).fill(0);

// ---------------------------------------------------------------- profile

export async function getProfile(): Promise<Profile | null> {
  const t = await table("profile");
  const rows = await t.query().where("id = 'singleton'").limit(1).toArray();
  const row = rows[0];
  if (!row) return null;
  return {
    goal: String(row.goal ?? ""),
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

export async function setGoal(goal: string, now: Date): Promise<Profile> {
  const existing = await getProfile();
  const profile: Profile = {
    goal,
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await upsert("profile", "id", [{ id: "singleton", ...profile }]);
  return profile;
}

// ----------------------------------------------------------------- skills

export async function recordSkill(
  skill: SkillRow,
): Promise<void> {
  const vector = await embedOne(`${skill.topic}. ${skill.evidence}`);
  await upsert("skills", "topic", [{ ...skill, vector }]);
}

export async function listSkills(): Promise<SkillRow[]> {
  const t = await table("skills");
  const rows = await t.query().toArray();
  return rows
    .map((r) => ({
      topic: String(r.topic ?? ""),
      level: Number(r.level ?? 0),
      confidence: Number(r.confidence ?? 0),
      evidence: String(r.evidence ?? ""),
      assessedAt: String(r.assessedAt ?? ""),
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

// ------------------------------------------------------------------ nodes

function rowToNode(r: Record<string, unknown>): RoadmapNode {
  let prereqs: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(r.prereqs ?? "[]"));
    if (Array.isArray(parsed)) prereqs = parsed.map(String);
  } catch {
    prereqs = [];
  }
  const dueRaw = String(r.dueAt ?? "");
  const review: Review = {
    reps: Number(r.reps ?? 0),
    ease: Number(r.ease ?? initialReview().ease),
    intervalDays: Number(r.intervalDays ?? 0),
    dueAt: dueRaw.length > 0 ? dueRaw : null,
  };
  return {
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    summary: String(r.summary ?? ""),
    prereqs,
    mastery: Number(r.mastery ?? 0),
    review,
  };
}

function nodeToRow(n: RoadmapNode, now: Date, vector: number[]) {
  return {
    id: n.id,
    title: n.title,
    summary: n.summary,
    prereqs: JSON.stringify(n.prereqs),
    mastery: n.mastery,
    reps: n.review.reps,
    ease: n.review.ease,
    intervalDays: n.review.intervalDays,
    dueAt: n.review.dueAt ?? "",
    updatedAt: now.toISOString(),
    vector,
  };
}

export async function listNodes(): Promise<RoadmapNode[]> {
  const t = await table("nodes");
  const rows = await t.query().toArray();
  return rows.map(rowToNode);
}

export async function getNode(id: string): Promise<RoadmapNode | null> {
  const nodes = await listNodes();
  return nodes.find((n) => n.id === id) ?? null;
}

/**
 * Insert or update roadmap nodes. Existing mastery and review state is preserved
 * unless the caller explicitly supplies it — re-proposing a roadmap must not wipe
 * out progress the learner already earned.
 */
export async function upsertNodes(
  incoming: Omit<RoadmapNode, "mastery" | "review">[],
  now: Date,
): Promise<RoadmapNode[]> {
  const existing = new Map((await listNodes()).map((n) => [n.id, n]));

  const merged: RoadmapNode[] = incoming.map((n) => {
    const prev = existing.get(n.id);
    return {
      ...n,
      mastery: prev?.mastery ?? 0,
      review: prev?.review ?? initialReview(),
    };
  });

  const vectors = await embed(merged.map((n) => `${n.title}. ${n.summary}`));
  const rows = merged.map((n, i) => nodeToRow(n, now, vectors[i] ?? ZERO_VECTOR));
  await upsert("nodes", "id", rows);
  return merged;
}

export async function updateNodeProgress(
  id: string,
  mastery: number,
  review: Review,
  now: Date,
): Promise<RoadmapNode | null> {
  const node = await getNode(id);
  if (!node) return null;
  const updated: RoadmapNode = { ...node, mastery, review };
  const vector = await embedOne(`${updated.title}. ${updated.summary}`);
  await upsert("nodes", "id", [nodeToRow(updated, now, vector)]);
  return updated;
}

export async function deleteNode(id: string): Promise<void> {
  const t = await table("nodes");
  await t.delete(`id = ${sqlString(id)}`);
}

// ---------------------------------------------------------------- lessons

export async function saveLesson(lesson: LessonRow): Promise<void> {
  const vector = await embedOne(`${lesson.title}. ${lesson.markdown}`);
  await upsert("lessons", "id", [{ ...lesson, vector }]);
}

export async function listLessons(nodeId?: string): Promise<LessonRow[]> {
  const t = await table("lessons");
  const q = t.query();
  const rows = await (nodeId ? q.where(`nodeId = ${sqlString(nodeId)}`) : q).toArray();
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    nodeId: String(r.nodeId ?? ""),
    title: String(r.title ?? ""),
    markdown: String(r.markdown ?? ""),
    createdAt: String(r.createdAt ?? ""),
  }));
}

// ------------------------------------------------------------------- quiz

export async function recordQuiz(item: QuizRow): Promise<void> {
  const vector = await embedOne(item.question);
  await upsert("quiz", "id", [{ ...item, vector }]);
}

export async function listQuiz(nodeId?: string): Promise<QuizRow[]> {
  const t = await table("quiz");
  const q = t.query();
  const rows = await (nodeId ? q.where(`nodeId = ${sqlString(nodeId)}`) : q).toArray();
  return rows
    .map((r) => ({
      id: String(r.id ?? ""),
      nodeId: String(r.nodeId ?? ""),
      question: String(r.question ?? ""),
      answerKey: String(r.answerKey ?? ""),
      response: String(r.response ?? ""),
      score: Number(r.score ?? 0),
      askedAt: String(r.askedAt ?? ""),
    }))
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}

// ----------------------------------------------------------------- search

export type SimilarHit = {
  kind: "lesson" | "quiz" | "node";
  id: string;
  title: string;
  snippet: string;
  distance: number;
};

/**
 * Semantic search across lessons, past questions and roadmap nodes. This is what
 * stops the tutor re-teaching a topic or asking the same question twice.
 */
export async function findSimilar(
  query: string,
  kinds: ("lesson" | "quiz" | "node")[],
  limit: number,
): Promise<SimilarHit[]> {
  const vector = await embedOne(query);
  const hits: SimilarHit[] = [];

  if (kinds.includes("lesson")) {
    const t = await table("lessons");
    for (const r of await t.vectorSearch(vector).limit(limit).toArray()) {
      hits.push({
        kind: "lesson",
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        snippet: String(r.markdown ?? "").slice(0, 240),
        distance: Number(r._distance ?? 0),
      });
    }
  }
  if (kinds.includes("quiz")) {
    const t = await table("quiz");
    for (const r of await t.vectorSearch(vector).limit(limit).toArray()) {
      hits.push({
        kind: "quiz",
        id: String(r.id ?? ""),
        title: String(r.question ?? ""),
        snippet: `answer: ${String(r.answerKey ?? "").slice(0, 200)}`,
        distance: Number(r._distance ?? 0),
      });
    }
  }
  if (kinds.includes("node")) {
    const t = await table("nodes");
    for (const r of await t.vectorSearch(vector).limit(limit).toArray()) {
      hits.push({
        kind: "node",
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        snippet: String(r.summary ?? "").slice(0, 240),
        distance: Number(r._distance ?? 0),
      });
    }
  }

  return hits.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/** Single-quote escaping for the SQL-ish filter strings LanceDB accepts. */
export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
