
import React from 'react';

interface MaturityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LevelCard: React.FC<{ 
    level: number; 
    title: string; 
    subtitle: string; 
    description: string; 
    color: string; 
    icon: React.ReactNode; 
    children: React.ReactNode 
}> = ({ level, title, subtitle, description, color, icon, children }) => (
  <div className={`bg-white border border-[var(--color-border-primary)] rounded-[var(--radius-xl)] p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02] flex flex-col`}>
    <div className="flex items-center space-x-4">
      <div className={`flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white shadow-md`}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>
       <div className="ml-auto flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-black/5 text-[var(--color-text-primary)] font-bold">
        {level}
      </div>
    </div>
    <p className="text-[var(--color-text-secondary)] mt-4 text-sm flex-grow">{description}</p>
    <div className="mt-4 text-sm text-[var(--color-text-secondary)] space-y-2">
      <p className="font-semibold text-[var(--color-text-primary)]">How this app helps:</p>
      {children}
    </div>
  </div>
);

const MaturityModal: React.FC<MaturityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const icons = {
      level1: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      level2: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      level3: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      level4: (
         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16v4m-2-2h4m5 10v4m-2-2h4M17 3l-4.5 4.5M12 12l9 9" />
        </svg>
      )
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-2xl)] shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--color-border-primary)] animate-scale-in" onClick={e => e.stopPropagation()}>
        <header className="p-5 border-b border-[var(--color-border-primary)] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AIOps Maturity Model</h2>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-3xl leading-none">&times;</button>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LevelCard 
            level={1} 
            title="Passive Ops" 
            subtitle="The Reactive Stage"
            color="from-red-500 to-orange-500"
            icon={icons.level1}
            description="Operations are highly manual and reactive. Teams spend time firefighting, reacting to alerts only after a failure occurs."
          >
            <ul className="list-disc list-inside">
              <li>The <strong>Logs</strong> and <strong>Changes</strong> tabs are your first step away from this, providing easy access to raw data without manual CLI commands.</li>
            </ul>
          </LevelCard>

          <LevelCard 
            level={2} 
            title="Active Ops" 
            subtitle="The Proactive Stage"
            color="from-amber-500 to-yellow-500"
            icon={icons.level2}
            description="Teams adopt an observability-based methodology, using telemetry from across the network to gain better insights and make more informed decisions."
          >
             <ul className="list-disc list-inside">
              <li><strong>Live Status Monitoring</strong> in the 'Status' tab and the <strong>VPN Dashboard</strong> move you into this stage, providing real-time visibility.</li>
            </ul>
          </LevelCard>

          <LevelCard 
            level={3} 
            title="AIOps" 
            subtitle="The Augmented Stage"
            color="from-blue-500 to-indigo-500"
            icon={icons.level3}
            description="Enterprises use AI to augment operations staff's analytical and decision-making abilities, leading to faster, more accurate outcomes."
          >
            <ul className="list-disc list-inside">
              <li>The app's core features operate here: <strong>Automated RCA</strong>, <strong>AI-driven log analysis</strong>, and <strong>natural language configuration</strong> of ports and firewalls.</li>
            </ul>
          </LevelCard>

          <LevelCard 
            level={4} 
            title="NoOps" 
            subtitle="The Autonomous Stage"
            color="from-green-500 to-emerald-500"
            icon={icons.level4}
            description="A visionary state where operations are fully autonomous and self-healing, supervised by humans who can focus on business value."
          >
            <ul className="list-disc list-inside">
              <li>While a future goal, features like <strong>Port Templates</strong> are a step towards automating repeatable, complex tasks to reduce human error and effort.</li>
            </ul>
          </LevelCard>
        </main>
      </div>
    </div>
  );
};

export default MaturityModal;
