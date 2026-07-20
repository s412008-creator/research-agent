"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, ShieldCheck, FileText, CheckCircle2, ChevronRight, Building2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function RelocationService() {
  const [topic, setTopic] = useState("我是一間台灣的 AI 軟體新創，團隊有 3 個人，年營收大概 100 萬美金。我想要搬到杜拜，幫我弄好一切。");
  const [logs, setLogs] = useState<{agent: string, msg: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const startOasis = async () => {
    setIsLoading(true);
    setLogs([]);
    
    try {
      const res = await fetch("http://localhost:8000/api/relocation", {
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
      setLogs(prev => [...prev, { agent: "ERROR", msg: "Connection to official portal failed. Please ensure backend services are active." }]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const toggleListen = () => {
    setIsListening(!isListening);
  };

  const getAgentLabel = (agentName: string) => {
    if (agentName.includes('Legal')) return { label: 'Legal & Policy Review', icon: <ShieldCheck className="w-5 h-5 text-white" />, bg: 'bg-[#0F172A]' };
    if (agentName.includes('Finance')) return { label: 'Financial Audit', icon: <FileText className="w-5 h-5 text-white" />, bg: 'bg-[#0F172A]' };
    if (agentName.includes('Concierge')) return { label: 'Concierge Synthesis', icon: <Building2 className="w-5 h-5 text-white" />, bg: 'bg-[#0F172A]' };
    if (agentName === 'SYSTEM_RESULT') return { label: 'Final Official Document', icon: <CheckCircle2 className="w-5 h-5 text-white" />, bg: 'bg-[#C6A87C]' };
    return { label: 'System Process', icon: <CheckCircle2 className="w-5 h-5 text-white" />, bg: 'bg-slate-400' };
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#F9FAFB]">
      
      {/* Official Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-[#0F172A] transition-colors p-2 -ml-2 rounded-md hover:bg-slate-100">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#C6A87C]" />
                Smart Relocation Concierge
              </h1>
            </div>
          </div>
          <div className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 rounded-full uppercase tracking-wide">
            Secure Session
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex flex-col lg:flex-row gap-10">
        
        {/* Left Column: Form */}
        <div className="w-full lg:w-5/12 flex flex-col">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-3">Application Context</h2>
            <p className="text-slate-600">
              Please provide your corporate profile. Our digital advisors will process your request in compliance with UAE federal guidelines.
            </p>
          </div>

          <div className="gov-card p-6 md:p-8">
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">
                Business Profile Statement
              </label>
              <button 
                onClick={toggleListen}
                className={`p-2 rounded-full transition-all ${isListening ? 'bg-[#0F172A] text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                title="Voice Input"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full h-40 bg-white border border-slate-300 rounded-lg p-4 text-[#0F172A] focus:outline-none focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] transition-all resize-none shadow-sm"
              placeholder="Describe your company size, industry, and objectives..."
            />
            
            <button 
              onClick={startOasis}
              disabled={isLoading}
              className="mt-6 w-full py-3.5 bg-[#0F172A] hover:bg-[#1e293b] text-white font-bold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing Application...
                </>
              ) : (
                <>
                  Submit to Authorities <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-xs text-center text-slate-500 mt-4">
              By submitting, you agree to the automated processing of your application data.
            </p>
          </div>
        </div>

        {/* Right Column: Vertical Stepper / Progress */}
        <div className="w-full lg:w-7/12 gov-card p-8 min-h-[600px] flex flex-col relative overflow-hidden">
          <div className="mb-6 pb-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-[#0F172A]">Application Processing Status</h3>
            <p className="text-sm text-slate-500 mt-1">Real-time official tracking log</p>
          </div>

          <div className="flex-1 overflow-y-auto relative px-2 py-4">
            {logs.length === 0 && !isLoading && (
              <div className="h-full flex items-center justify-center text-slate-400">
                Awaiting application submission...
              </div>
            )}

            <div className="space-y-8 relative">
              <AnimatePresence>
              {logs.map((log, i) => {
                const isFinal = log.agent === 'SYSTEM_RESULT';
                const isError = log.agent === 'ERROR';
                const { label, icon, bg } = getAgentLabel(log.agent);

                // For final report, show full document
                if (isFinal) {
                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 border-t-2 border-[#C6A87C] pt-8"
                    >
                      <div className="bg-white border border-[#C6A87C] rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-[#C6A87C]/30 px-6 py-4 flex items-center justify-between">
                          <h4 className="font-bold text-[#0F172A] flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-[#C6A87C]" />
                            Official Dubai Relocation Roadmap
                          </h4>
                          <span className="text-xs font-bold bg-[#C6A87C]/10 text-[#8B7355] px-2 py-1 rounded">APPROVED</span>
                        </div>
                        <div className="p-6 text-[#0F172A] whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
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
                    className="relative pl-10"
                  >
                    {/* Stepper Line */}
                    {i !== logs.length - 1 && (
                      <div className={`stepper-line ${isLoading && i === logs.length - 1 ? 'stepper-line-active' : ''}`}></div>
                    )}
                    
                    {/* Stepper Node */}
                    <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center ${isError ? 'bg-red-500' : bg} ring-4 ring-white z-10`}>
                      <div className="scale-50">{icon}</div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-lg p-4 shadow-sm ml-2">
                      <h5 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isError ? 'text-red-600' : 'text-[#C6A87C]'}`}>
                        {label}
                      </h5>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {log.msg}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </div>
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>
      </main>
    </div>
  );
}
