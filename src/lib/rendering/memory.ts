import { readFileSync, statfsSync } from "node:fs";

/**
 * Lightweight process + container memory snapshot for render diagnostics.
 * Reads Node's own memory plus Linux cgroup limits and /dev/shm usage. Every
 * source is best-effort: on Windows (or when a path is absent) the field is
 * null and nothing throws — this must never crash a render.
 */

export interface MemorySnapshot {
  rssMb: number;
  heapUsedMb: number;
  externalMb: number;
  /** cgroup memory.current (v2) / memory.usage_in_bytes (v1). */
  cgroupCurrentMb: number | null;
  /** cgroup memory.max (v2) / memory.limit_in_bytes (v1); null if unlimited. */
  cgroupMaxMb: number | null;
  devShmUsedMb: number | null;
  devShmTotalMb: number | null;
}

const toMb = (bytes: number) => Math.round(bytes / (1024 * 1024));

function readNumberFile(path: string): number | null {
  try {
    const raw = readFileSync(path, "utf8").trim();
    if (raw === "" || raw === "max") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function firstNumber(paths: string[]): number | null {
  for (const path of paths) {
    const value = readNumberFile(path);
    if (value !== null) return value;
  }
  return null;
}

function devShm(): { used: number | null; total: number | null } {
  try {
    const s = statfsSync("/dev/shm");
    const total = Number(s.blocks) * Number(s.bsize);
    const used = (Number(s.blocks) - Number(s.bfree)) * Number(s.bsize);
    return { used: toMb(used), total: toMb(total) };
  } catch {
    return { used: null, total: null };
  }
}

export function memorySnapshot(): MemorySnapshot {
  const m = process.memoryUsage();
  const cgroupCurrent = firstNumber([
    "/sys/fs/cgroup/memory.current",
    "/sys/fs/cgroup/memory/memory.usage_in_bytes",
  ]);
  const cgroupMax = firstNumber([
    "/sys/fs/cgroup/memory.max",
    "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  ]);
  const shm = devShm();
  return {
    rssMb: toMb(m.rss),
    heapUsedMb: toMb(m.heapUsed),
    externalMb: toMb(m.external),
    cgroupCurrentMb: cgroupCurrent === null ? null : toMb(cgroupCurrent),
    cgroupMaxMb: cgroupMax === null ? null : toMb(cgroupMax),
    devShmUsedMb: shm.used,
    devShmTotalMb: shm.total,
  };
}

export function formatMemorySnapshot(s: MemorySnapshot): string {
  const na = (v: number | null) => (v === null ? "n/a" : `${v}MB`);
  return [
    `rss=${s.rssMb}MB`,
    `heapUsed=${s.heapUsedMb}MB`,
    `external=${s.externalMb}MB`,
    `cgroupCurrent=${na(s.cgroupCurrentMb)}`,
    `cgroupMax=${na(s.cgroupMaxMb)}`,
    `devShm=${na(s.devShmUsedMb)}/${na(s.devShmTotalMb)}`,
  ].join(" ");
}
