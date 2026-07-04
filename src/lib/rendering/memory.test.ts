import { describe, expect, it } from "vitest";

import { formatMemorySnapshot, memorySnapshot } from "./memory";

describe("memorySnapshot", () => {
  it("returns numeric process memory and never throws", () => {
    const s = memorySnapshot();
    expect(typeof s.rssMb).toBe("number");
    expect(typeof s.heapUsedMb).toBe("number");
    expect(typeof s.externalMb).toBe("number");
    expect(s.rssMb).toBeGreaterThan(0);
  });

  it("reports cgroup/dev-shm as a number or null (degrades safely)", () => {
    const s = memorySnapshot();
    for (const v of [
      s.cgroupCurrentMb,
      s.cgroupMaxMb,
      s.devShmUsedMb,
      s.devShmTotalMb,
    ]) {
      expect(v === null || typeof v === "number").toBe(true);
    }
  });

  it("formats a single-line summary with all fields", () => {
    const line = formatMemorySnapshot(memorySnapshot());
    expect(line).toContain("rss=");
    expect(line).toContain("cgroupCurrent=");
    expect(line).toContain("cgroupMax=");
    expect(line).toContain("devShm=");
  });
});
