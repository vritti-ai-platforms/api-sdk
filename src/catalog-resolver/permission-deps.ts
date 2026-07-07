// Intra-feature permission prerequisites: e.g. add/edit/delete depend on view, and view depends on dim.view.
// Only DIRECT edges are declared per permission; the transitive closure is computed by recursion here.
// All traversals are cycle-guarded so a malformed (cyclic) graph degrades gracefully instead of hanging.

// Permission code -> the codes it DIRECTLY depends on (within the same feature)
export type DependsMap = Map<string, string[]>;

// Builds a dependency map from a feature's permissions, keeping only edges to codes present in the set
export function buildDependsMap(permissions: Array<{ code: string; dependsOn?: string[] }>): DependsMap {
  const present = new Set(permissions.map((p) => p.code));
  const map: DependsMap = new Map();
  for (const p of permissions) {
    map.set(
      p.code,
      (p.dependsOn ?? []).filter((dep) => dep !== p.code && present.has(dep)),
    );
  }
  return map;
}

// Transitive prerequisite closure of a code (excludes the code itself), cycle-safe
export function prereqClosure(code: string, deps: DependsMap): string[] {
  const out = new Set<string>();
  const seen = new Set<string>([code]);
  const stack = [code];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const dep of deps.get(current) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      out.add(dep);
      stack.push(dep);
    }
  }
  return [...out];
}

// Codes locked after cascade: a code is locked if it is directly locked OR any (transitive) prerequisite is.
// On a cycle, a revisited node returns false (does not propagate a phantom lock).
export function cascadeLocked(codes: string[], directlyLocked: Set<string>, deps: DependsMap): Set<string> {
  const locked = new Set<string>();
  const visiting = new Set<string>();
  const check = (code: string): boolean => {
    if (locked.has(code)) return true;
    if (directlyLocked.has(code)) {
      locked.add(code);
      return true;
    }
    if (visiting.has(code)) return false;
    visiting.add(code);
    const viaDep = (deps.get(code) ?? []).some(check);
    visiting.delete(code);
    if (viaDep) locked.add(code);
    return viaDep;
  };
  for (const code of codes) check(code);
  return locked;
}

// Keeps only codes whose FULL prerequisite closure is also present — drops a dependent missing any prerequisite.
// On a cycle, a revisited node returns true (does not drop the whole chain).
export function filterGrantedByDeps(granted: Set<string>, deps: DependsMap): Set<string> {
  const ok = new Set<string>();
  const visiting = new Set<string>();
  const check = (code: string): boolean => {
    if (ok.has(code)) return true;
    if (!granted.has(code)) return false;
    if (visiting.has(code)) return true;
    visiting.add(code);
    const satisfied = (deps.get(code) ?? []).every(check);
    visiting.delete(code);
    if (satisfied) ok.add(code);
    return satisfied;
  };
  for (const code of granted) check(code);
  return ok;
}
