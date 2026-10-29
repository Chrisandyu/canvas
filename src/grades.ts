import type { Assignment, AssignmentGroup, Course } from "./api";

export type GroupResult = {
  group: AssignmentGroup;
  earned: number;
  possible: number;
  /** null when nothing in the group is graded yet. */
  percent: number | null;
  dropped: Set<number>;
};

export type CourseResult = {
  percent: number | null;
  groups: GroupResult[];
  weighted: boolean;
};

type ScoreOf = (a: Assignment) => number | null;

function counts(a: Assignment, scoreOf: ScoreOf): boolean {
  return scoreOf(a) !== null && !a.submission?.excused && !a.omit_from_final_grade;
}

/** Applies the group's drop_lowest/drop_highest rules by per-assignment percentage. */
function dropped(group: AssignmentGroup, graded: Assignment[], scoreOf: ScoreOf): Set<number> {
  const ratio = (a: Assignment) => {
    const pts = a.points_possible ?? 0;
    return pts > 0 ? scoreOf(a)! / pts : Infinity;
  };
  const never = new Set(group.rules.never_drop ?? []);
  const candidates = graded.filter((a) => !never.has(a.id)).sort((a, b) => ratio(a) - ratio(b));
  // Always keep at least one graded assignment in the group.
  const maxDrops = Math.max(0, graded.length - 1);
  const low = Math.min(group.rules.drop_lowest ?? 0, maxDrops);
  const high = Math.min(group.rules.drop_highest ?? 0, maxDrops - low);
  const drop = [...candidates.slice(0, low), ...candidates.slice(candidates.length - high)];
  return new Set(drop.map((a) => a.id));
}

function groupResult(group: AssignmentGroup, scoreOf: ScoreOf): GroupResult {
  const graded = group.assignments.filter((a) => counts(a, scoreOf));
  const drop = dropped(group, graded, scoreOf);
  const kept = graded.filter((a) => !drop.has(a.id));
  const earned = kept.reduce((sum, a) => sum + scoreOf(a)!, 0);
  const possible = kept.reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
  return {
    group,
    earned,
    possible,
    percent: kept.length && possible > 0 ? (earned / possible) * 100 : null,
    dropped: drop,
  };
}

/**
 * Current grade from every score visible to the student, whether or not the
 * instructor has released the course total. Ungraded work is left out.
 */
export function courseGrade(course: Course, groups: AssignmentGroup[], scoreOf: ScoreOf): CourseResult {
  const results = groups.map((g) => groupResult(g, scoreOf));
  const weighted = course.apply_assignment_group_weights;
  let percent: number | null = null;

  if (weighted) {
    // Canvas rescales by the weights of groups that have graded work.
    const active = results.filter((r) => r.percent !== null && r.group.group_weight > 0);
    const weight = active.reduce((sum, r) => sum + r.group.group_weight, 0);
    if (weight > 0) percent = active.reduce((sum, r) => sum + r.percent! * r.group.group_weight, 0) / weight;
  } else {
    const earned = results.reduce((sum, r) => sum + r.earned, 0);
    const possible = results.reduce((sum, r) => sum + r.possible, 0);
    if (possible > 0) percent = (earned / possible) * 100;
  }

  return { percent, groups: results, weighted };
}

const SCALE: [number, string][] = [
  [93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"],
  [73, "C"], [70, "C-"], [67, "D+"], [63, "D"], [60, "D-"], [0, "F"],
];

/** Standard UCLA letter scale; individual courses may use their own cutoffs. */
export function letter(percent: number): string {
  return SCALE.find(([min]) => percent >= min)![1];
}

export function officialScore(course: Course): number | null {
  return course.enrollments?.find((e) => e.type === "student")?.computed_current_score ?? null;
}
