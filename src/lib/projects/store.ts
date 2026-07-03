import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Project } from "@/lib/video/types";

/**
 * Project persistence (FR-2, TR-7). `ProjectStore` is the contract; the
 * JSON-file adapter below is the local default. Swapping to SQLite/Postgres
 * later is a new adapter behind this same interface — routes and services
 * import the interface, never a concrete store.
 *
 * Durability model: every write goes to a unique temp file and is atomically
 * renamed into place, so a crash mid-write can only ever leave an orphaned
 * `*.tmp` (ignored by reads), never a half-written project. Readers therefore
 * only ever observe fully-committed records.
 */

/** Default location for project records, relative to the project root. */
export const PROJECTS_DIR = path.join(".data", "projects");

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`No project with id "${id}".`);
    this.name = "ProjectNotFoundError";
  }
}

export interface ProjectStore {
  create(project: Project): Promise<void>;
  get(id: string): Promise<Project | null>;
  /** Merge-updates an existing project; throws ProjectNotFoundError if absent. */
  update(id: string, patch: Partial<Project>): Promise<Project>;
  list(): Promise<Project[]>;
  /** Idempotent: deleting an unknown id is a no-op (safe to retry). */
  delete(id: string): Promise<void>;
}

/**
 * Ids are server-generated UUIDs, but this store may be reached with route
 * params, so guard against anything that could escape the data dir before
 * building a path from an id (TR-9).
 */
const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(`Invalid project id: ${JSON.stringify(id)}.`);
  }
}

export class JsonFileProjectStore implements ProjectStore {
  private readonly rootDir: string;

  constructor(rootDir: string = path.join(process.cwd(), PROJECTS_DIR)) {
    this.rootDir = rootDir;
  }

  private filePath(id: string): string {
    assertSafeId(id);
    return path.join(this.rootDir, `${id}.json`);
  }

  private async writeAtomic(project: Project): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const destination = this.filePath(project.id);
    // Unique temp name so concurrent writers never clobber each other's temp.
    const tmp = path.join(
      this.rootDir,
      `.${project.id}.${crypto.randomUUID()}.tmp`
    );
    await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await rename(tmp, destination);
  }

  async create(project: Project): Promise<void> {
    await this.writeAtomic(project);
  }

  async get(id: string): Promise<Project | null> {
    let raw: string;
    try {
      raw = await readFile(this.filePath(id), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    return JSON.parse(raw) as Project;
  }

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const existing = await this.get(id);
    if (!existing) throw new ProjectNotFoundError(id);
    // Identity fields are owned by the store, not the caller.
    const updated: Project = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.writeAtomic(updated);
    return updated;
  }

  async list(): Promise<Project[]> {
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    // Only committed `.json` files; orphaned `.tmp` writes are skipped.
    const files = entries.filter((name) => name.endsWith(".json"));
    const projects = await Promise.all(
      files.map(async (name) => {
        const raw = await readFile(path.join(this.rootDir, name), "utf8");
        return JSON.parse(raw) as Project;
      })
    );
    return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<void> {
    await rm(this.filePath(id), { force: true });
  }
}

let defaultStore: ProjectStore | undefined;

/** Process-wide default store (JSON files under `.data/projects/`). */
export function getProjectStore(): ProjectStore {
  if (!defaultStore) defaultStore = new JsonFileProjectStore();
  return defaultStore;
}
