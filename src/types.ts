export type TenantId = "salesforce" | "slack" | "github";

export type Classification =
  | "reversible"
  | "compensable"
  | "irreversible"
  | "UNKNOWN";

export type Runbook = "trustlink" | "revoke-only";

export interface Identity {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface Token {
  id: string;
  identityId: string;
  tenant: TenantId;
  issuedAt: string;
  scopes: string[];
  revoked: boolean;
  frozen: boolean;
}

export interface Effect {
  id: string;
  mutationId: string;
  tenant: TenantId;
  summary: string;
  classification: Classification;
  /** Why this classification — especially for UNKNOWN and irreversible. */
  rationale: string;
  /** Residual risk that remains even after a successful compensation. */
  residualRisk?: string;
}

export interface Mutation {
  id: string;
  at: string;
  tenant: TenantId;
  actorId: string;
  kind: string;
  summary: string;
  /** Mutation ids this one depended on / was enabled by. */
  causedBy: string[];
  target: string;
  details: Record<string, unknown>;
  effects: Effect[];
}

export interface Compensation {
  id: string;
  effectId: string;
  mutationId: string;
  tenant: TenantId;
  kind: string;
  summary: string;
  /** Inverse of exact state vs risk-reducing compensation. */
  mode: "inverse" | "compensate";
}

export interface PlanStep {
  order: number;
  compensation: Compensation;
  dependsOnCleared: string[];
}

export type StepOutcome =
  | "simulated_ok"
  | "simulated_fail"
  | "executed"
  | "abstained_unknown"
  | "skipped_irreversible"
  | "blocked_by_simulation"
  | "not_attempted";

export interface StepResult {
  effectId: string;
  mutationId: string;
  classification: Classification;
  planned?: PlanStep;
  outcome: StepOutcome;
  detail: string;
}

export interface Invariant {
  id: string;
  summary: string;
  holds: boolean;
  evidence: string;
}

export interface AccessProbe {
  id: string;
  summary: string;
  expectedDead: boolean;
  stillWorks: boolean;
}

export interface Metrics {
  runbook: Runbook;
  timeMs: number;
  mutationCount: number;
  effectCount: number;
  repairableCount: number;
  repairedCount: number;
  coverage: number;
  unknownAbstentions: number;
  irreversibleLeft: number;
  residualActiveEffects: number;
  falseUndoPositives: number;
  invariantsHeld: number;
  invariantsTotal: number;
  leftoverAttackPaths: number;
}

export interface RunResult {
  runbook: Runbook;
  identity: Identity;
  freeze: { locked: boolean; detail: string };
  revoke: { tokenIds: string[]; detail: string };
  mutations: Mutation[];
  effects: Effect[];
  causalEdges: Array<{ from: string; to: string }>;
  plan: PlanStep[];
  steps: StepResult[];
  invariants: Invariant[];
  reonboard?: {
    newIdentity: Identity;
    newTokenIds: string[];
    leastPrivilege: boolean;
    scopes: string[];
    detail: string;
  };
  accessProbes: AccessProbe[];
  metrics: Metrics;
}

export interface ComparisonReport {
  generatedAt: string;
  incident: string;
  trustlink: RunResult;
  revokeOnly: RunResult;
  winner: {
    coverage: Runbook;
    leftoverAttackPaths: Runbook;
    falseUndoPositives: Runbook | "tie";
  };
  whatWeDoNotUndo: string[];
}
