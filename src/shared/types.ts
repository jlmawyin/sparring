export type CriterionId = 'empathy' | 'discovery' | 'objection_handling' | 'solution_integrity' | 'closing';
export interface Turn { turn_id: string; role: 'USER' | 'AGENT'; text: string; received_at_ms: number; interrupted?: boolean; }
export interface Evidence { quote: string; user_turn_id: string; rationale: string; source_call_id: string; }
export interface CriterionScore { id: CriterionId; label: string; weight: number; level: number | null; evidence: Evidence | null; }
export interface ScoreSnapshot { revision: number; criteria: CriterionScore[]; coverage: number; total: number | null; provisional: boolean; limitations: string[]; next_action: string; }
export interface ScenarioBrief { id: string; version: string; title: string; brief: string; role: string; facts: Record<string, unknown>; authority: Record<string, unknown>; }
export interface Catalog { scenarios: ScenarioBrief[]; criteria: { id: CriterionId; label: string; weight: number }[]; }
export interface Health { status: string; key_configured: boolean; voice_enabled: boolean; mode: 'local' | 'production'; }
export interface StartRequest { scenario_id: string; scenario_version: string; consent: true; }
export interface StartResponse { session_id: string; session_context: string; token: string; max_seconds: number; deadline: number; session_config: Record<string, unknown>; }
export interface EvaluateRequest { session_context: string; revision: number; tool_call_id: string; tool_name: 'score_rubric' | 'log_objection'; arguments: Record<string, unknown>; transcript_final: Turn[]; }
export interface EvaluateResponse { snapshot: ScoreSnapshot; result: Record<string, unknown>; processing_ms: number; }
export type VoiceState = 'idle' | 'preparing' | 'connecting' | 'roleplay' | 'finalizing' | 'coaching' | 'ending' | 'ended' | 'error';
export interface VoiceCallbacks { onState(state: VoiceState): void; onTurn(turn: Turn): void; onPartial(role: 'USER' | 'AGENT', text: string): void; onSnapshot(snapshot: ScoreSnapshot): void; onError(message: string): void; onEvent?(type: string): void; }
export interface VoiceController { start(scenario: ScenarioBrief): Promise<void>; finish(): Promise<void>; stop(): void; }
