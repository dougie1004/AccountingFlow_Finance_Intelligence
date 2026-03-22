import { invoke } from "@tauri-apps/api/core";

function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === "object" && Object.prototype.toString.call(value) === "[object Object]") {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(sortKeysDeep(value));
}

function diffFields(original: any, echoed: any, path = ""): string[] {
  const diffs: string[] = [];

  if (original === echoed) return diffs;

  const originalIsArray = Array.isArray(original);
  const echoedIsArray = Array.isArray(echoed);

  if (originalIsArray || echoedIsArray) {
    if (!originalIsArray || !echoedIsArray) {
      diffs.push(`${path || "root"}: type mismatch`);
      return diffs;
    }

    if (original.length !== echoed.length) {
      diffs.push(`${path || "root"}: array length mismatch (${original.length} vs ${echoed.length})`);
    }

    const max = Math.max(original.length, echoed.length);
    for (let i = 0; i < max; i++) {
        const itemDiffs = diffFields(original[i], echoed[i], `${path}[${i}]`);
        diffs.push(...itemDiffs);
    }
    return diffs;
  }

  const originalIsObj =
    original && typeof original === "object" && Object.prototype.toString.call(original) === "[object Object]";
  const echoedIsObj =
    echoed && typeof echoed === "object" && Object.prototype.toString.call(echoed) === "[object Object]";

  if (originalIsObj || echoedIsObj) {
    if (!originalIsObj || !echoedIsObj) {
      diffs.push(`${path || "root"}: type mismatch`);
      return diffs;
    }

    const keys = Array.from(new Set([...Object.keys(original), ...Object.keys(echoed)])).sort();

    for (const key of keys) {
      diffs.push(...diffFields(original[key], echoed[key], path ? `${path}.${key}` : key));
    }

    return diffs;
  }

  if (original !== echoed) {
    diffs.push(`${path || "root"}: ${JSON.stringify(original)} !== ${JSON.stringify(echoed)}`);
  }

  return diffs;
}

export const verifyJournalIntegrity = async (journalEntries: any[]) => {
  console.log("==================================");
  console.log("🧪 START JOURNAL INTEGRITY CHECK");

  const echoed = await invoke<any[]>("debug_echo_journals", {
    journals: journalEntries,
  });

  console.log("📤 FRONT ORIGINAL:", journalEntries);
  console.log("📥 RUST ECHO:", echoed);

  const originalStable = stableStringify(journalEntries);
  const echoedStable = stableStringify(echoed);

  const isEqual = originalStable === echoedStable;

  console.log("==================================");
  console.log("✅ INTEGRITY RESULT:", isEqual ? "PASS" : "FAIL");

  if (!isEqual) {
    console.error("❌ DIFF DETECTED");

    const diffs = diffFields(journalEntries, echoed);

    console.log("총 diff 개수:", diffs.length);
    console.log("상위 100개 diff:", diffs.slice(0, 100));

    const max = Math.max(journalEntries.length, echoed.length);

    for (let i = 0; i < max; i++) {
      const o = journalEntries[i];
      const e = echoed[i];

      if (stableStringify(o) !== stableStringify(e)) {
        console.group(`🔍 DIFF @ index ${i}`);
        console.log("ORIGINAL:", o);
        console.log("ECHOED :", e);
        console.log("FIELD DIFFS:", diffFields(o, e));
        console.groupEnd();
      }
    }
  }

  console.log("==================================");

  return {
    isEqual,
    original: journalEntries,
    echoed,
  };
};
