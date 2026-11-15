<script lang="ts">
  import { courseGrade, letter, officialScore } from "./grades";
  import { courseCode, courseTitle } from "./names.svelte";
  import { store } from "./store.svelte";
  import type { Assignment } from "./api";
  import { gradescopeFor, scoreOf } from "./status.svelte";

  let rows = $derived(
    (store.courses ?? [])
      .filter((c) => store.groups[c.id]?.some((g) => g.assignments.length))
      .map((c) => ({
        c,
        result: courseGrade(c, store.groups[c.id], scoreOf),
        official: officialScore(c),
      })),
  );

  // Graded by the instructor, but neither Canvas nor Gradescope shows the score yet.
  const isUnreleased = (a: Assignment) => a.submission?.workflow_state === "graded" && scoreOf(a) === null;
  // Canvas hides it, but Gradescope has it.
  const fromGradescope = (a: Assignment) => a.submission?.score == null && gradescopeFor(a)?.score != null;

  const pct = (n: number) => `${n.toFixed(2)}%`;
</script>

<h1>Grades</h1>


<ul class="list">
  {#each rows as { c, result, official } (c.id)}
    <li class="panel">
      <details>
        <summary class="course">
          <span>
            <span class="code">{courseCode(c) || "N/A"}</span>
            <span class="name">{courseTitle(c)}</span>
          </span>
          <span class="official">
            Canvas: {official !== null ? pct(official) : "hidden"}
          </span>
          {#if result.percent !== null}
            <span class="grade">{pct(result.percent)} <b>{letter(result.percent)}</b></span>
          {:else}
            <span class="grade muted">No grades yet</span>
          {/if}
        </summary>

        <div class="groups">
          {#each result.groups as g (g.group.id)}
            <div class="group">
              <div class="group-head">
                <span>{g.group.name}</span>
                <span>{result.weighted ? `${g.group.group_weight}% of grade` : ""}</span>
                <span>{g.possible ? `${+g.earned.toFixed(2)} / ${g.possible}` : ""}</span>
                <span>{g.percent !== null ? pct(g.percent) : "—"}</span>
              </div>
              {#each g.group.assignments as a (a.id)}
                <div class="assignment" class:dropped={g.dropped.has(a.id)}>
                  <span>{a.name}</span>
                  <span>
                    {#if a.submission?.excused}Excused
                    {:else if scoreOf(a) !== null}{#if fromGradescope(a)}<span class="source">Gradescope</span>{/if}{scoreOf(a)} / {a.points_possible}
                    {:else if isUnreleased(a)}Not released / {a.points_possible}
                    {:else}— / {a.points_possible ?? "?"}{/if}
                  </span>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </details>
    </li>
  {:else}
    <li class="muted">Loading…</li>
  {/each}
</ul>

<style>
  details > summary.course {
    display: grid;
    grid-template-columns: 1fr 150px 150px;
    gap: var(--gap);
    align-items: center;
    padding: 12px var(--pad);
    margin: 0;
    color: var(--text);
    list-style: none;
  }
  .code {
    color: var(--accent);
    margin-right: 8px;
  }
  .name {
    font-weight: 700;
  }
  .official {
    text-align: right;
  }
  .grade {
    text-align: right;
    font-size: 1.1em;
  }
  .grade b {
    color: var(--accent);
    margin-left: 6px;
  }
  .groups {
    border-top: 1px solid var(--border);
    padding: 8px var(--pad) 12px;
  }
  .group {
    margin-top: 10px;
  }
  .group-head {
    display: grid;
    grid-template-columns: 1fr 120px 110px 80px;
    gap: var(--gap);
    font-weight: 700;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .group-head span:not(:first-child) {
    text-align: right;
  }
  .assignment {
    display: flex;
    justify-content: space-between;
    padding: 3px 0 3px 12px;
  }
  .source {
    font-size: 0.8em;
    margin-right: 8px;
    opacity: 0.7;
  }
  .dropped {
    text-decoration: line-through;
    opacity: 0.5;
  }
</style>
