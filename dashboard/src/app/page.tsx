"use client";

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [topic, setTopic] = useState("我是一間台灣的 AI 軟體新創，團隊有 3 個人，年營收大概 100 萬美金。我想要搬到杜拜，幫我弄好一切。");
  const [logs, setLogs] = useState<{agent: string, msg: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const startOasis = async () => {
    setIsLoading(true);
    setLogs([]);
    
    try {
      const res = await fetch("http://localhost:8000/api/oasis-crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic })
      });
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 2);
          
          if (chunk.startsWith("data: ")) {
            const dataStr = chunk.substring(6);
            if (dataStr === "[DONE]") break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "agent_log") {
                setLogs(prev => [...prev, { agent: data.agent, msg: data.msg }]);
              } else if (data.type === "result") {
                 setLogs(prev => [...prev, { agent: "SYSTEM_RESULT", msg: data.report }]);
              }
            } catch (e) {
                // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, { agent: "ERROR", msg: "連線至伺服器失敗，請確認後端已啟動。" }]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Helper to format agent names professionally
  const formatAgentName = (name: string) => {
    if (name === 'SYSTEM_RESULT') return 'Final Report';
    return name.replace(/_/g, ' ');
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-700">
      
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Oasis<span className="text-primary-600">.ai</span>
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500">
            Enterprise Relocation Protocol
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Title Section */}
        <section className="text-center space-y-4 py-6">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            Global Expansion, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-emerald-500">Automated.</span>
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Input your company profile below. Our AI expert team will analyze regulations, calculate tax implications, and draft a complete roadmap for your transition to Dubai.
          </p>
        </section>

        {/* Input Panel */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 rounded-l-2xl"></div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Company Profile & Requirements</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe your company and your goals..."
              className="w-full h-32 bg-white border border-slate-200 rounded-xl p-4 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none text-base shadow-sm"
            />
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={startOasis}
              disabled={isLoading}
              className="relative overflow-hidden group px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-slate-900/10 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing Analysis...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Roadmap</span>
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </div>
            </button>
          </div>
        </section>

        {/* Activity Feed / Logs */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Execution Activity
            </h3>
            {isLoading && (
              <span className="flex items-center gap-2 text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                Agents Active
              </span>
            )}
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 font-mono text-sm space-y-4">
            {logs.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-12">
                <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>Awaiting initialization. System is standing by.</p>
              </div>
            )}

            <div className="space-y-6">
              {logs.map((log, i) => {
                const isFinal = log.agent === 'SYSTEM_RESULT';
                const isError = log.agent === 'ERROR';
                
                if (isFinal) {
                  return (
                    <div key={i} className="mt-8 pt-8 border-t border-slate-100 animate-fade-in-up">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 font-sans">Final Relocation Roadmap</h4>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-6 text-slate-700 whitespace-pre-wrap leading-relaxed font-sans shadow-sm border border-slate-200">
                        {log.msg}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="flex gap-4 animate-fade-in-up group">
                    <div className="w-32 shrink-0 flex flex-col items-end pt-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        isError ? 'bg-red-100 text-red-700' :
                        log.agent.includes('Legal') ? 'bg-blue-100 text-blue-700' :
                        log.agent.includes('Finance') ? 'bg-emerald-100 text-emerald-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {formatAgentName(log.agent)}
                      </span>
                    </div>
                    <div className="flex-1 pb-4 border-b border-slate-100 group-last:border-0 group-last:pb-0">
                      <p className={`text-slate-600 leading-relaxed ${isError ? 'text-red-600 font-medium' : ''}`}>
                        {log.msg}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-1" />
            </div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="text-center text-sm text-slate-400 pt-8 pb-4">
          Powered by CrewAI & Gemini 1.5 Pro. Designed for Enterprise.
        </footer>
        
      </div>
    </main>
  );
}
