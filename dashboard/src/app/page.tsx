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
                 setLogs(prev => [...prev, { agent: "SYSTEM_RESULT", msg: "\n\n================ FINAL ROADMAP ================\n\n" + data.report }]);
              }
            } catch (e) {
                // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, { agent: "ERROR", msg: "Connection failed to backend." }]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <header className="flex flex-col items-center justify-center space-y-2 mb-4">
        <h1 className="text-5xl font-bold text-green-500 matrix-text tracking-widest uppercase">
          Oasis.ai
        </h1>
        <p className="text-green-400 opacity-80 uppercase text-sm tracking-widest">
          Autonomous Dubai Relocation Multi-Agent Protocol
        </p>
      </header>

      {/* Input Section */}
      <div className="terminal-box p-6 rounded-lg flex flex-col gap-4">
        <div className="flex items-center gap-2 text-green-400">
          <span className="animate-pulse">▶</span>
          <span>ENTER_STARTUP_PROFILE</span>
        </div>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full h-24 bg-black/50 border border-green-800 rounded p-4 text-green-300 focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(0,255,0,0.5)] transition-all resize-none font-mono"
        />
        <button 
          onClick={startOasis}
          disabled={isLoading}
          className="self-end px-8 py-3 bg-green-900/50 hover:bg-green-800 border border-green-500 rounded text-green-100 font-bold tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_15px_#0f0]"
        >
          {isLoading ? "EXECUTING_PROTOCOL..." : "INITIALIZE_AGENTS"}
        </button>
      </div>

      {/* Terminal View */}
      <div className="terminal-box flex-1 min-h-[500px] rounded-lg p-6 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-8 bg-green-900/30 border-b border-green-800 flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          <span className="ml-4 text-xs tracking-widest opacity-70">CREW_AI_ORCHESTRATOR_TERMINAL</span>
        </div>
        
        <div className="mt-10 overflow-y-auto flex-1 font-mono text-sm space-y-2 pb-8">
          {logs.length === 0 && !isLoading && (
            <div className="text-green-800 animate-pulse">
              Waiting for uplink...
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 fade-in">
              <span className="text-green-600 w-24 shrink-0 border-r border-green-800 pr-2 text-right uppercase text-xs pt-1">
                [{log.agent}]
              </span>
              <span className={`typewriter ${log.agent === 'SYSTEM_RESULT' ? 'text-cyan-400 font-bold whitespace-pre-wrap' : 'text-green-300'}`}>
                {log.msg}
              </span>
            </div>
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
      
    </main>
  );
}
