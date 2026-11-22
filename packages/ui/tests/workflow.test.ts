import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findWorkflowIssues, layoutWorkflow } from '../src/lib/workflow';
import type { WorkflowNode, WorkflowPhase } from '../src/types';

const phases: WorkflowPhase[] = [
  { id: 'one', title: 'One' },
  { id: 'two', title: 'Two' },
  { id: 'three', title: 'Three' },
];
const node = (id: string, phase: string, dependsOn?: string[]): WorkflowNode => ({
  id,
  phase,
  title: id.toUpperCase(),
  description: `about ${id}`,
  dependsOn,
});
const valid = [
  node('start', 'one'),
  node('a', 'two', ['start']),
  node('b', 'two', ['start']),
  node('end', 'three', ['a', 'b']),
];

describe('findWorkflowIssues', () => {
  it('accepts a connected workflow', () => {
    assert.deepEqual(findWorkflowIssues(valid, phases), []);
  });
  it('rejects duplicate ids, unknown phases and empty phases', () => {
    const issues = findWorkflowIssues([...valid, node('a', 'nowhere', ['start'])], phases);
    assert.ok(issues.some((i) => i.includes('Duplicate node id "a"')));
    assert.ok(issues.some((i) => i.includes('unknown phase "nowhere"')));
    assert.ok(
      findWorkflowIssues([node('start', 'one')], phases).some((i) =>
        i.includes('Phase "two" has no nodes'),
      ),
    );
  });
  it('rejects unknown parents and parents that are not in an earlier phase', () => {
    const issues = findWorkflowIssues(
      [
        node('start', 'one'),
        node('a', 'two', ['ghost']),
        node('b', 'two', ['a']),
        node('c', 'three', ['start']),
      ],
      phases,
    );
    assert.ok(issues.some((i) => i.includes('unknown node "ghost"')));
    assert.ok(issues.some((i) => i.includes('"b" must sit in a later phase than its parent "a"')));
  });
  it('needs exactly one start node, in the first phase', () => {
    assert.ok(
      findWorkflowIssues([node('a', 'two', ['x'])], phases).some((i) =>
        i.includes('no start node'),
      ),
    );
    const orphan = findWorkflowIssues([...valid, node('lost', 'two')], phases);
    assert.ok(orphan.some((i) => i.includes('No parent: "lost"')));
    const late = findWorkflowIssues(
      [node('start', 'two'), node('x', 'three', ['start']), node('y', 'one', undefined)],
      phases,
    );
    assert.ok(late.some((i) => i.includes('must be in the first phase')));
  });
});

describe('layoutWorkflow', () => {
  const layout = layoutWorkflow(valid, phases);

  it('numbers nodes in reading order across phases', () => {
    assert.deepEqual(
      layout.nodes.map((n) => [n.id, n.number]),
      [
        ['start', 1],
        ['a', 2],
        ['b', 3],
        ['end', 4],
      ],
    );
    assert.deepEqual(
      layout.phases.map((p) => [p.index, p.nodes.length]),
      [
        [0, 1],
        [1, 2],
        [2, 1],
      ],
    );
  });
  it('derives requires, unlocks and edges from dependsOn', () => {
    const start = layout.byId.get('start')!;
    assert.deepEqual(start.requires, []);
    assert.deepEqual(start.unlocks, ['a', 'b']);
    assert.deepEqual(layout.byId.get('end')!.requires, ['a', 'b']);
    assert.deepEqual(layout.edges, [
      { from: 'start', to: 'a' },
      { from: 'start', to: 'b' },
      { from: 'a', to: 'end' },
      { from: 'b', to: 'end' },
    ]);
  });
  it('throws with every problem listed for an invalid workflow', () => {
    assert.throws(
      () => layoutWorkflow([node('a', 'one', ['zzz'])], phases),
      /Invalid workflow[\s\S]*zzz/,
    );
  });
});
