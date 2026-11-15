import type { Course } from "./api";

const KEY = "courseOrder";

/** Course ids in the user's chosen order. Courses not in it (e.g. a new term) go last, in Canvas order. */
const order = $state<number[]>(JSON.parse(localStorage.getItem(KEY) ?? "[]"));

export function sortCourses(courses: Course[]): Course[] {
  const rank = (c: Course) => {
    const i = order.indexOf(c.id);
    return i === -1 ? Infinity : i;
  };
  return [...courses].sort((a, b) => rank(a) - rank(b));
}

/** Moves course `from` to the position of course `to`, within the currently shown list. */
export function moveCourse(shown: Course[], from: number, to: number): void {
  const ids = shown.map((c) => c.id);
  const target = ids.indexOf(to);
  ids.splice(ids.indexOf(from), 1);
  ids.splice(target, 0, from);
  order.splice(0, order.length, ...ids);
  localStorage.setItem(KEY, JSON.stringify(order));
}
