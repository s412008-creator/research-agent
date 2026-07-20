"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Globe, Shield, Coins, Sparkles, Terminal } from 'lucide-react';

export default function Home() {
  const [topic, setTopic] = useState("我是一間台灣的 AI 軟體新創，團隊有 3 個人，年營收大概 100 萬美金。我想要搬到杜拜，幫我弄好一切。");
  const [logs, setLogs] = useState<{agent: string, msg: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
                // Ignore parse errors
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

  const toggleListen = () => {
    setIsListening(!isListening);
    // Placeholder for actual Web Speech API integration
  };

  const getAgentIcon = (agentName: string) => {
    if (agentName.includes('Legal')) return <Shield className="w-4 h-4 text-blue-400" />;
    if (agentName.includes('Finance')) return <Coins className="w-4 h-4 text-emerald-400" />;
    if (agentName.includes('Executive') || agentName.includes('Concierge')) return <Globe className="w-4 h-4 text-purple-400" />;
    return <Sparkles className="w-4 h-4 text-[#D4AF37]" />;
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#D4AF37]/10 blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="glass-panel border-b-0 sticky top-0 z-20 px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8E7522] flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white gold-glow-text">
            OASIS<span className="text-[#D4AF37]">.AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs tracking-widest uppercase text-gray-400 border border-gray-800 px-3 py-1 rounded-full bg-black/50">
            Enterprise Relocation Protocol
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col md:flex-row gap-8 relative z-10">
        
        {/* Left Column: Input & Context */}
        <div className="w-full md:w-5/12 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Global Expansion, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#FFF1C5]">
                Automated.
              </span>
            </h2>
            <p className="text-gray-400 text-lg">
              Describe your company and goals. Our Multi-Agent AI team will analyze free zones, calculate taxes, and generate your Dubai Golden Visa roadmap.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-6 relative group"
          >
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-[#D4AF37] tracking-widest uppercase">
                Corporate Profile
              </label>
              <button 
                onClick={toggleListen}
                className={`p-2 rounded-full transition-all duration-300 ${isListening ? 'bg-[#D4AF37] text-black shadow-[0_0_20px_#D4AF37] scale-110' : 'bg-white/5 text-gray-400 hover:bg-[#D4AF37]/20 hover:text-[#D4AF37]'}`}
                title="Voice Input"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
            
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full h-32 bg-black/40 border border-[#D4AF37]/20 rounded-xl p-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all resize-none"
            />
            
            <button 
              onClick={startOasis}
              disabled={isLoading}
              className="mt-6 w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B38E2A] hover:from-[#E5C158] hover:to-[#D4AF37] text-black font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  INITIALIZING AGENTS...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  EXECUTE PROTOCOL
                </>
              )}
            </button>
          </motion.div>
        </div>

        {/* Right Column: Real-time Terminal */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full md:w-7/12 flex flex-col terminal-container rounded-2xl overflow-hidden min-h-[600px] relative"
        >
          {/* Terminal Header */}
          <div className="bg-black/80 border-b border-[#D4AF37]/20 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                Real-time Agentic Core
              </h3>
            </div>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-600"></div>
              <div className="w-3 h-3 rounded-full bg-gray-600"></div>
              <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${isLoading ? 'bg-[#D4AF37] shadow-[0_0_10px_#D4AF37] animate-pulse' : 'bg-gray-600'}`}></div>
            </div>
          </div>
          
          {/* Terminal Logs */}
          <div className="p-6 overflow-y-auto flex-1 font-mono text-sm space-y-4 z-0">
            {logs.length === 0 && !isLoading && (
              <div className="h-full flex items-center justify-center text-gray-500 opacity-50">
                SYSTEM STANDBY. AWAITING INPUT.
              </div>
            )}

            <AnimatePresence>
              {logs.map((log, i) => {
                const isFinal = log.agent === 'SYSTEM_RESULT';
                const isError = log.agent === 'ERROR';

                if (isFinal) {
                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-8 relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-xl blur-xl"></div>
                      <div className="glass-panel border-[#D4AF37]/50 rounded-xl p-6 relative z-10">
                        <div className="flex items-center gap-3 mb-4 border-b border-[#D4AF37]/20 pb-4">
                          <Sparkles className="w-6 h-6 text-[#D4AF37]" />
                          <h4 className="text-xl font-bold text-white tracking-wider">FINAL RELOCATION ROADMAP</h4>
                        </div>
                        <div className="text-gray-200 whitespace-pre-wrap leading-relaxed font-sans text-base">
                          {log.msg}
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4"
                  >
                    <div className="w-36 shrink-0 flex items-start justify-end pt-1 gap-2 border-r border-[#D4AF37]/20 pr-4">
                      <span className={`text-xs tracking-wider uppercase font-bold text-right ${isError ? 'text-red-500' : 'text-[#D4AF37]'}`}>
                        {log.agent.replace(/_/g, ' ')}
                      </span>
                      {!isError && getAgentIcon(log.agent)}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className={`leading-relaxed ${isError ? 'text-red-400' : 'text-gray-300'}`}>
                        <span className="text-[#D4AF37]/50 mr-2">{'>'}</span>
                        {log.msg}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomRef} className="h-4" />
          </div>
        </motion.div>

      </div>
    </main>
  );
}
