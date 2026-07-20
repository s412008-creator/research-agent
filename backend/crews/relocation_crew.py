import os
import json
import asyncio
import io
import sys
import threading
from typing import AsyncGenerator
from dotenv import load_dotenv

from crewai import Agent, Task, Crew, Process
from langchain_google_genai import ChatGoogleGenerativeAI
from tavily import TavilyClient

load_dotenv()

# 初始化 Gemini
llm = ChatGoogleGenerativeAI(
    model=os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
    temperature=0.2,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)

# 定義 3 個核心 Agents
legal_expert = Agent(
    role="Legal & Policy Expert",
    goal="Analyze the user's profile, recommend the best free zone, and determine Golden Visa eligibility according to UAE law.",
    backstory="A senior policy advisor at the Dubai Department of Economy and Tourism (DET), specializing in corporate law and Golden Visa regulations.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

finance_specialist = Agent(
    role="Financial Analyst",
    goal="Calculate first-year setup costs and estimate the 9% Corporate Tax impact.",
    backstory="An official financial auditor in the UAE. Expert in translating business models into tax and visa fee projections in compliance with the Ministry of Finance.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

executive_assistant = Agent(
    role="Relocation Concierge",
    goal="Synthesize the legal and finance reports into a highly professional, government-style 'Dubai Relocation Roadmap'.",
    backstory="A specialized government liaison officer who formats complex bureaucratic data into clear, accessible Markdown roadmaps for foreign investors.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

class LogCapture(io.StringIO):
    def __init__(self, loop, queue: asyncio.Queue):
        super().__init__()
        self.loop = loop
        self.queue = queue
        self.current_agent = "SYSTEM"

    def write(self, s):
        if s.strip():
            # 推送到 asyncio queue
            # 解析 CrewAI 日誌來猜測當前的 Agent
            lower_s = s.lower()
            if "legal & policy expert" in lower_s:
                self.current_agent = "Legal Expert"
            elif "financial analyst" in lower_s:
                self.current_agent = "Financial Analyst"
            elif "relocation concierge" in lower_s:
                self.current_agent = "Relocation Concierge"
            
            asyncio.run_coroutine_threadsafe(
                self.queue.put({"type": "agent_log", "agent": self.current_agent, "msg": s.strip()}), 
                self.loop
            )
        super().write(s)

class RelocationCrewOrchestrator:
    async def run(self, user_profile: str) -> AsyncGenerator[dict, None]:
        log_queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        task1 = Task(
            description=f"Analyze the following startup profile: '{user_profile}'. Determine if they need a physical warehouse, recommend the best Dubai Free Zone (e.g., IFZA, DMCC, DIFC), and check Golden Visa eligibility.",
            expected_output="A brief official report stating physical space needs, recommended Free Zone, and Golden Visa eligibility.",
            agent=legal_expert
        )

        task2 = Task(
            description="Based on the Legal Expert's Free Zone recommendation, calculate the estimated first-year setup costs (company setup + visa fees in USD). Also, provide a short estimation on the 9% Corporate Tax impact.",
            expected_output="A structured cost breakdown and a summary of the 9% UAE Corporate Tax implications.",
            agent=finance_specialist
        )

        task3 = Task(
            description="Combine the outputs of the previous tasks into a single 'Dubai Relocation Roadmap' in Traditional Chinese (Markdown). Format it like an official UAE Government document. Include: 1. 建議自貿區與政策解讀, 2. 簽證申請路徑與資格, 3. 首年財務與稅務預估. Ensure it looks extremely professional.",
            expected_output="A complete, official Markdown roadmap in Traditional Chinese.",
            agent=executive_assistant
        )

        crew = Crew(
            agents=[legal_expert, finance_specialist, executive_assistant],
            tasks=[task1, task2, task3],
            process=Process.sequential,
            verbose=True
        )

        old_stdout = sys.stdout
        sys.stdout = LogCapture(loop, log_queue)

        def _kickoff():
            try:
                return crew.kickoff()
            finally:
                pass

        await log_queue.put({"type": "agent_switch", "agent": "SYSTEM"})
        await log_queue.put({"type": "agent_log", "agent": "SYSTEM", "msg": "[初始化] 杜拜官方落地智慧顧問系統啟動中..."})
        
        task_obj = asyncio.to_thread(_kickoff)

        while not task_obj.done():
            try:
                msg = log_queue.get_nowait()
                yield msg
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.1)

        sys.stdout = old_stdout

        while not log_queue.empty():
            yield log_queue.get_nowait()

        result = await task_obj

        yield {
            "type": "result",
            "report": result.raw if hasattr(result, 'raw') else str(result),
            "sources": []
        }
