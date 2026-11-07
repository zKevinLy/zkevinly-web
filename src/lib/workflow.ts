// Layout + validation for a topic page's workflow. Pure functions, no Node-only
// APIs: used by the build (Workflow component, hub checks) and safe in the browser.

import type { WorkflowNode, WorkflowPhase } from '../config';

export interface Edge {
  from: string;
  to: string;
}

export interface LaidOutNode extends WorkflowNode {
  /** 1-based reading order across the whole workflow. */
  number: number;
  /** Parent ids (what this step requires). */
  requires: string[];
  /** Child ids (what this step unlocks). */
  unlocks: string[];
}

export interface LaidOutPhase {
  phase: WorkflowPhase;
  index: number;
  nodes: LaidOutNode[];
}

export interface WorkflowLayout {
  phases: LaidOutPhase[];
  /** Every node in reading order. */
  nodes: LaidOutNode[];
  edges: Edge[];
  byId: Map<string, LaidOutNode>;
}

/**
 * Rules that keep the path connected:
 *  - exactly one start node (no parents), and it sits in the first phase;
 *  - every other node has at least one parent;
 *  - parents are in an earlier phase, so the graph always flows downward and
 *    can never contain a cycle.
 */
export function findWorkflowIssues(nodes: WorkflowNode[], phases: WorkflowPhase[]): string[] {
  const issues: string[] = [];
  const phaseIndex = new Map<string, number>(phases.map((p, i) => [p.id, i] as [string, number]));
  const byId = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    if (byId.has(node.id)) issues.push(`Duplicate node id "${node.id}".`);
    byId.set(node.id, node);
    if (!phaseIndex.has(node.phase)) {
      issues.push(`Node "${node.id}" uses unknown phase "${node.phase}".`);
    }
  }

  for (const phase of phases) {
    if (!nodes.some((node) => node.phase === phase.id)) {
      issues.push(`Phase "${phase.id}" has no nodes.`);
    }
  }

  for (const node of nodes) {
    for (const dependency of node.dependsOn ?? []) {
      const parent = byId.get(dependency);
      if (!parent) {
        issues.push(`Node "${node.id}" depends on unknown node "${dependency}".`);
        continue;
      }
      const parentPhase = phaseIndex.get(parent.phase);
      const ownPhase = phaseIndex.get(node.phase);
      if (parentPhase !== undefined && ownPhase !== undefined && parentPhase >= ownPhase) {
        issues.push(`Node "${node.id}" must sit in a later phase than its parent "${dependency}".`);
      }
    }
  }

  const roots = nodes.filter((node) => (node.dependsOn?.length ?? 0) === 0);
  const [start, ...orphans] = roots;
  if (!start) {
    issues.push('The workflow has no start node.');
  } else if (phaseIndex.get(start.phase) !== 0) {
    issues.push(`The start node "${start.id}" must be in the first phase.`);
  }
  if (orphans.length > 0) {
    issues.push(
      `Every node except the start needs a parent. No parent: ${orphans.map((n) => `"${n.id}"`).join(', ')}.`,
    );
  }

  return issues;
}

export function layoutWorkflow(nodes: WorkflowNode[], phases: WorkflowPhase[]): WorkflowLayout {
  const issues = findWorkflowIssues(nodes, phases);
  if (issues.length > 0) {
    throw new Error(`Invalid workflow:\n - ${issues.join('\n - ')}`);
  }

  const unlocks = new Map<string, string[]>(nodes.map((n) => [n.id, []] as [string, string[]]));
  const edges: Edge[] = [];
  for (const node of nodes) {
    for (const dependency of node.dependsOn ?? []) {
      unlocks.get(dependency)?.push(node.id);
      edges.push({ from: dependency, to: node.id });
    }
  }

  let number = 0;
  const laidOut: LaidOutPhase[] = phases.map((phase, index) => ({
    phase,
    index,
    nodes: nodes
      .filter((node) => node.phase === phase.id)
      .map((node) => ({
        ...node,
        number: ++number,
        requires: node.dependsOn ?? [],
        unlocks: unlocks.get(node.id) ?? [],
      })),
  }));

  const flat = laidOut.flatMap((group) => group.nodes);
  return {
    phases: laidOut,
    nodes: flat,
    edges,
    byId: new Map<string, LaidOutNode>(flat.map((n) => [n.id, n] as [string, LaidOutNode])),
  };
}
