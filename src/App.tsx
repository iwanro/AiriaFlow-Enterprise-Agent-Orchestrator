import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Database, 
  Cpu, 
  UserCheck, 
  FileText,
  Send,
  Zap,
  LayoutDashboard,
  Settings,
  HelpCircle,
  Search,
  Copy,
  Download,
  Check,
  ExternalLink,
  ShieldCheck,
  BarChart3,
  Server
} from 'lucide-react';
import { TaskStatus, EnterpriseTask, AgentStep } from './types';
import { analyzeTask, generateAgentAction } from './services/gemini';

type ViewType = 'dashboard' | 'activity' | 'database' | 'settings';

// --- Mock Initial Data ---
const INITIAL_TASKS: EnterpriseTask[] = [
  {
    id: '1',
    title: 'Customer Refund Request #8821',
    description: 'Customer requesting full refund for damaged shipment of high-value electronics.',
    priority: 'high',
    status: TaskStatus.COMPLETED,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    steps: [
      { id: 's1', agentName: 'TriageBot', action: 'Analyzing sentiment and urgency', status: 'done', timestamp: new Date(Date.now() - 3500000).toISOString() },
      { id: 's2', agentName: 'LogisticsAgent', action: 'Checking shipping logs in ERP', status: 'done', timestamp: new Date(Date.now() - 3400000).toISOString() },
      { id: 's3', agentName: 'FinanceAgent', action: 'Verifying payment status in Stripe', status: 'done', timestamp: new Date(Date.now() - 3300000).toISOString() },
    ],
    result: '### Analysis Summary\n- **Status**: Refund Processed\n- **Reason**: Verified shipping damage through ERP logs.\n- **Action**: $1,240.00 credited back to customer card.\n\n### Next Steps\n1. Notify customer via automated email.\n2. File insurance claim with FedEx using tracking #FX-9921.\n3. Update inventory status to "Damaged/Write-off".'
  },
  {
    id: '2',
    title: 'New Vendor Onboarding',
    description: 'Process compliance documents for "Global Logistics Solutions Inc."',
    priority: 'medium',
    status: TaskStatus.AWAITING_APPROVAL,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    steps: [
      { id: 's4', agentName: 'ComplianceBot', action: 'Scanning documents for risk factors', status: 'done', timestamp: new Date(Date.now() - 1700000).toISOString() },
      { id: 's5', agentName: 'LegalAgent', action: 'Drafting MSA based on standard template', status: 'done', timestamp: new Date(Date.now() - 1600000).toISOString() },
      { id: 's6', agentName: 'Human-in-the-Loop', action: 'Final contract approval', status: 'working', timestamp: new Date(Date.now() - 1500000).toISOString() },
    ]
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('activity');
  const [tasks, setTasks] = useState<EnterpriseTask[]>(INITIAL_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(INITIAL_TASKS[0].id);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (task: EnterpriseTask) => {
    const content = `Report: ${task.title}\nDate: ${new Date(task.createdAt).toLocaleString()}\n\nDescription:\n${task.description}\n\nResult:\n${task.result || 'No result yet.'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AiriaFlow_Report_${task.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDesc.trim()) return;

    setIsProcessing(true);
    const id = Math.random().toString(36).substr(2, 9);
    
    const newTask: EnterpriseTask = {
      id,
      title: newTaskDesc.split(' ').slice(0, 4).join(' ') + '...',
      description: newTaskDesc,
      priority: 'medium',
      status: TaskStatus.ANALYZING,
      createdAt: new Date().toISOString(),
      steps: []
    };

    setTasks([newTask, ...tasks]);
    setSelectedTaskId(id);
    setIsCreating(false);
    setNewTaskDesc('');

    try {
      const analysis = await analyzeTask(newTaskDesc);
      
      setTasks(prev => prev.map(t => t.id === id ? {
        ...t,
        status: TaskStatus.GATHERING_DATA,
        steps: analysis.suggestedSteps.map((s, i) => ({
          id: `step-${id}-${i}`,
          agentName: i === 0 ? 'TriageBot' : 'SystemAgent',
          action: s,
          status: 'idle',
          timestamp: new Date().toISOString()
        }))
      } : t));

      for (let i = 0; i < analysis.suggestedSteps.length; i++) {
        const currentStep = analysis.suggestedSteps[i];
        setTasks(prev => prev.map(t => t.id === id ? {
          ...t,
          steps: t.steps.map((s, idx) => idx === i ? { ...s, status: 'working' } : s)
        } : t));

        const result = await generateAgentAction(currentStep, newTaskDesc);
        await new Promise(r => setTimeout(r, 1500));

        setTasks(prev => prev.map(t => t.id === id ? {
          ...t,
          steps: t.steps.map((s, idx) => idx === i ? { ...s, status: 'done', details: result } : s)
        } : t));
      }

      setTasks(prev => prev.map(t => t.id === id ? {
        ...t,
        status: analysis.requiresApproval ? TaskStatus.AWAITING_APPROVAL : TaskStatus.COMPLETED,
        result: analysis.requiresApproval ? undefined : `### Workflow Summary\n- **Analysis**: ${analysis.analysis}\n- **Outcome**: Successfully orchestrated ${analysis.suggestedSteps.length} agent actions.\n\n### Detailed Findings\n${analysis.suggestedSteps.map(s => `- Action "${s}" completed without errors.`).join('\n')}`
      } : t));

    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: TaskStatus.FAILED } : t));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      status: TaskStatus.COMPLETED,
      result: '### Human Approval Granted\n- **Operator**: ffffdv@gmail.com\n- **Action**: Final deployment authorized.\n\n### System Update\nAll pending agent actions have been committed to the production environment. Compliance logs updated.'
    } : t));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView tasks={tasks} />;
      case 'database':
        return <DatabaseView />;
      case 'settings':
        return <SettingsView />;
      case 'activity':
      default:
        return (
          <main className="flex flex-1 h-full overflow-hidden">
            {/* --- Task Sidebar --- */}
            <section className="w-80 border-r border-white/5 flex flex-col bg-[#0D0D0D]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight">Active Agents</h2>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tasks.map(task => (
                  <motion.div
                    key={task.id}
                    layoutId={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedTaskId === task.id 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${
                        task.priority === 'high' ? 'text-rose-400' : 'text-zinc-500'
                      }`}>
                        {task.priority} Priority
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                    <h3 className="font-medium text-sm line-clamp-1 mb-1">{task.title}</h3>
                    <p className="text-xs text-zinc-500 line-clamp-2">{task.description}</p>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* --- Workflow View --- */}
            <section className="flex-1 flex flex-col relative bg-[#0A0A0A] overflow-hidden">
              {selectedTask ? (
                <>
                  <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#0A0A0A]/50 backdrop-blur-md z-10">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight mb-2">{selectedTask.title}</h1>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(selectedTask.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3" /> Multi-Agent Orchestration
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {selectedTask.result && (
                        <>
                          <button 
                            onClick={() => handleCopy(selectedTask.result!)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 text-zinc-400 hover:text-white"
                            title="Copy Result"
                          >
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleDownload(selectedTask)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 text-zinc-400 hover:text-white"
                            title="Download Report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {selectedTask.status === TaskStatus.AWAITING_APPROVAL && (
                        <button 
                          onClick={() => handleApprove(selectedTask.id)}
                          className="px-6 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                          <UserCheck className="w-4 h-4" /> Approve Workflow
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl mx-auto space-y-12">
                      {/* --- Description Card --- */}
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                          <FileText className="w-3 h-3" /> Task Context
                        </h4>
                        <p className="text-zinc-300 leading-relaxed">{selectedTask.description}</p>
                      </div>

                      {/* --- Agent Steps Timeline --- */}
                      <div className="space-y-6 relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/5" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8 pl-10">
                          Agent Execution Pipeline
                        </h4>
                        
                        {selectedTask.steps.map((step, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={step.id} 
                            className="relative pl-12"
                          >
                            <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A] z-10 ${
                              step.status === 'done' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                              step.status === 'working' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-800'
                            }`} />
                            
                            <div className={`p-5 rounded-2xl border transition-all ${
                              step.status === 'working' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5'
                            }`}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-mono text-emerald-400">@{step.agentName}</span>
                                <span className="text-[10px] text-zinc-600">{new Date(step.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-sm font-medium mb-2">{step.action}</p>
                              {step.details && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="text-xs text-zinc-500 bg-black/30 p-3 rounded-lg border border-white/5 font-mono"
                                >
                                  {step.details}
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {selectedTask.result && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="pl-12"
                          >
                            <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ShieldCheck className="w-24 h-24 text-emerald-500" />
                              </div>
                              <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Orchestration Final Report
                              </h4>
                              <div className="prose prose-invert prose-sm max-w-none">
                                {selectedTask.result.split('\n').map((line, i) => {
                                  if (line.startsWith('###')) {
                                    return <h3 key={i} className="text-lg font-bold text-white mt-6 mb-3">{line.replace('### ', '')}</h3>;
                                  }
                                  if (line.startsWith('- **')) {
                                    const [label, ...rest] = line.replace('- **', '').split('**: ');
                                    return (
                                      <div key={i} className="flex gap-2 mb-2">
                                        <span className="text-emerald-400 font-bold min-w-[100px]">{label}:</span>
                                        <span className="text-zinc-300">{rest.join('**: ')}</span>
                                      </div>
                                    );
                                  }
                                  if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
                                    return (
                                      <div key={i} className="flex gap-3 mb-2 items-start">
                                        <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold mt-0.5">{line[0]}</span>
                                        <span className="text-zinc-300">{line.substring(3)}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={i} className="text-zinc-400 mb-2">{line.replace('- ', '')}</p>;
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                  <Zap className="w-12 h-12 mb-4 opacity-20" />
                  <p>Select a task to view orchestration</p>
                </div>
              )}
            </section>
          </main>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* --- Navigation Rail --- */}
      <nav className="fixed left-0 top-0 bottom-0 w-16 bg-[#111] border-r border-white/5 flex flex-col items-center py-6 gap-8 z-50">
        <div 
          onClick={() => setCurrentView('dashboard')}
          className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-105 transition-transform"
        >
          <Zap className="text-black w-6 h-6" />
        </div>
        <div className="flex flex-col gap-6 text-zinc-500">
          <NavItem 
            icon={LayoutDashboard} 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={Activity} 
            active={currentView === 'activity'} 
            onClick={() => setCurrentView('activity')} 
          />
          <NavItem 
            icon={Database} 
            active={currentView === 'database'} 
            onClick={() => setCurrentView('database')} 
          />
          <NavItem 
            icon={Settings} 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
          />
        </div>
        <div className="mt-auto">
          <HelpCircle className="w-6 h-6 text-zinc-600 cursor-pointer hover:text-white transition-colors" />
        </div>
      </nav>

      {/* --- View Container --- */}
      <div className="pl-16 h-screen overflow-hidden flex flex-col">
        {renderView()}
      </div>

      {/* --- Create Task Modal --- */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setIsCreating(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">Initiate New Agent Workflow</h3>
              <form onSubmit={handleCreateTask}>
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    Task Description
                  </label>
                  <textarea 
                    autoFocus
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="e.g., Analyze the Q4 logistics report and flag any compliance issues with international shipping..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    disabled={isProcessing || !newTaskDesc.trim()}
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Deploy Agents
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`relative group cursor-pointer p-2 rounded-lg transition-colors ${active ? 'text-white' : 'hover:text-white'}`}
    >
      <Icon className="w-6 h-6" />
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -right-2 top-2 bottom-2 w-1 bg-emerald-500 rounded-full"
        />
      )}
    </div>
  );
}

// --- View Components ---

function DashboardView({ tasks }: { tasks: EnterpriseTask[] }) {
  const stats = [
    { label: 'Active Agents', value: '12', icon: Cpu, color: 'text-emerald-400' },
    { label: 'Tasks Completed', value: tasks.filter(t => t.status === TaskStatus.COMPLETED).length.toString(), icon: CheckCircle2, color: 'text-blue-400' },
    { label: 'System Health', value: '99.9%', icon: Activity, color: 'text-purple-400' },
    { label: 'Data Nodes', value: '4', icon: Database, color: 'text-amber-400' },
  ];

  return (
    <div className="p-8 overflow-y-auto flex-1">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">System Overview</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label} 
              className="bg-white/5 border border-white/5 p-6 rounded-3xl"
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mb-4`} />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white/5 border border-white/5 rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Orchestration Performance</h3>
              <BarChart3 className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="h-64 flex items-end gap-2">
              {[40, 70, 45, 90, 65, 80, 55, 95, 75, 85, 60, 100].map((h, i) => (
                <motion.div 
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05, duration: 1 }}
                  className="flex-1 bg-emerald-500/20 rounded-t-lg border-t border-emerald-500/40"
                />
              ))}
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-3xl p-8">
            <h3 className="text-lg font-bold mb-6">Agent Status</h3>
            <div className="space-y-4">
              {['TriageBot', 'LogisticsAgent', 'FinanceAgent', 'ComplianceBot'].map((agent) => (
                <div key={agent} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-sm font-medium">{agent}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">ONLINE</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabaseView() {
  return (
    <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-6 border border-amber-500/20">
        <Database className="w-10 h-10 text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Connected Knowledge Bases</h2>
      <p className="text-zinc-500 max-w-md mb-8">
        Manage the data sources your agents use for research and decision making.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        {['Enterprise ERP', 'Stripe API', 'Zendesk Docs', 'SharePoint'].map(db => (
          <div key={db} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-zinc-400" />
              <span className="font-medium">{db}</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-600" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="p-8 flex-1 max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Orchestration Engine</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div>
                <p className="font-medium">Model Selection</p>
                <p className="text-xs text-zinc-500">Gemini 3 Flash (Optimized for speed)</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div>
                <p className="font-medium">Autonomous Level</p>
                <p className="text-xs text-zinc-500">High (Requires approval for financial actions)</p>
              </div>
              <div className="w-12 h-6 bg-emerald-500 rounded-full flex items-center px-1">
                <div className="w-4 h-4 bg-black rounded-full ml-auto" />
              </div>
            </div>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Security</h3>
          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
            <p className="text-rose-400 font-medium mb-1">Emergency Kill-Switch</p>
            <p className="text-xs text-rose-400/60 mb-4">Instantly halt all active agent processes across all systems.</p>
            <button className="w-full py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-colors">
              Halt All Systems
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const configs = {
    [TaskStatus.PENDING]: { icon: Clock, color: 'text-zinc-500', bg: 'bg-zinc-500/10', label: 'Pending' },
    [TaskStatus.ANALYZING]: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Analyzing' },
    [TaskStatus.GATHERING_DATA]: { icon: Database, color: 'text-indigo-400', bg: 'bg-indigo-400/10', label: 'Gathering' },
    [TaskStatus.AWAITING_APPROVAL]: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Review' },
    [TaskStatus.EXECUTING]: { icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Executing' },
    [TaskStatus.COMPLETED]: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Done' },
    [TaskStatus.FAILED]: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-400/10', label: 'Failed' },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bg} ${config.color} border border-current/10`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{config.label}</span>
    </div>
  );
}
