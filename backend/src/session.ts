import { readFile, writeFile, readdir, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ChatMessage } from "./deepseek.js";

export interface SessionMeta {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messageCount: number;
  workspaceRoot?: string;
  scope: "global" | "project";
  topicId?: string;
}

export interface Session {
  meta: SessionMeta;
  messages: ChatMessage[];
  systemPrompt: string;
}

const SESSIONS_DIR = join(import.meta.dirname || ".", "..", "sessions");

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

function generatePreview(messages: ChatMessage[]): string {
  for (const msg of messages) {
    if (msg.role === "user" && msg.content) {
      return msg.content.slice(0, 100).replace(/\n/g, " ").trim();
    }
  }
  return "(empty session)";
}

function generateTitle(messages: ChatMessage[]): string {
  for (const msg of messages) {
    if (msg.role === "user" && msg.content) {
      const title = msg.content.slice(0, 50).replace(/\n/g, " ").trim();
      return title || "Untitled";
    }
  }
  return "New Session";
}

export class SessionStore {
  private static async ensureDir() {
    if (!existsSync(SESSIONS_DIR)) {
      await mkdir(SESSIONS_DIR, { recursive: true });
    }
  }

  static async create(
    id: string,
    systemPrompt: string,
    model: string,
    scope: "global" | "project" = "global",
    workspaceRoot?: string
  ): Promise<Session> {
    await this.ensureDir();
    const now = new Date().toISOString();
    const session: Session = {
      meta: {
        id,
        title: "New Session",
        preview: "",
        createdAt: now,
        updatedAt: now,
        model,
        messageCount: 0,
        workspaceRoot,
        scope,
        topicId: id,
      },
      messages: [{ role: "system", content: systemPrompt }],
      systemPrompt,
    };
    await writeFile(sessionPath(id), JSON.stringify(session, null, 2));
    return session;
  }

  static async load(id: string): Promise<Session | null> {
    await this.ensureDir();
    try {
      const data = await readFile(sessionPath(id), "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async save(session: Session): Promise<void> {
    await this.ensureDir();
    session.meta.updatedAt = new Date().toISOString();
    session.meta.messageCount = session.messages.filter(m => m.role !== "system").length;
    session.meta.preview = generatePreview(session.messages);
    session.meta.title = generateTitle(session.messages);
    await writeFile(sessionPath(session.meta.id), JSON.stringify(session, null, 2));
  }

  static async delete(id: string): Promise<void> {
    try {
      await unlink(sessionPath(id));
    } catch {
      // already deleted
    }
  }

  static async list(): Promise<SessionMeta[]> {
    await this.ensureDir();
    const metas: SessionMeta[] = [];
    try {
      const files = await readdir(SESSIONS_DIR);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = await readFile(join(SESSIONS_DIR, file), "utf-8");
          const session = JSON.parse(data) as Session;
          metas.push(session.meta);
        } catch {
          // skip corrupt files
        }
      }
    } catch {
      // dir doesn't exist yet
    }
    return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  static async rename(id: string, title: string): Promise<void> {
    const session = await this.load(id);
    if (!session) return;
    session.meta.title = title;
    await this.save(session);
  }
}

export const DEFAULT_SYSTEM_PROMPT = `You are Reasonix, a mobile AI coding assistant powered by DeepSeek. You help users with software engineering tasks.

You are running in mobile mode. You can:
- Read, write, and search code files
- Execute shell commands
- Manage project structures
- Create todo lists to track progress

Be concise and direct. Use the tools available to accomplish the user's goal efficiently.
When you create a todo list, use the todo_write tool to help users track progress.

Current date: ${new Date().toISOString().split("T")[0]}
`;