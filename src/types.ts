export enum TaskStatus {
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING',
  GATHERING_DATA = 'GATHERING_DATA',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface AgentStep {
  id: string;
  agentName: string;
  action: string;
  status: 'idle' | 'working' | 'done' | 'error';
  timestamp: string;
  details?: string;
}

export interface EnterpriseTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: TaskStatus;
  steps: AgentStep[];
  result?: string;
  createdAt: string;
}

export interface AIResponse {
  analysis: string;
  suggestedSteps: string[];
  requiresApproval: boolean;
}
