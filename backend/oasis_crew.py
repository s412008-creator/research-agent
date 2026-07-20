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
    role="UAE Corporate Lawyer",
    goal="Analyze the user's profile and recommend the best free zone, and determine Golden Visa eligibility.",
    backstory="An elite UAE corporate lawyer with deep knowledge of IFZA, DMCC, and DIFC rules. Specialized in AI and tech startups.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

finance_specialist = Agent(
    role="UAE Tax Consultant",
    goal="Calculate first-year setup costs and estimate the 9% Corporate Tax impact.",
    backstory="A precise financial modeler. Knows exactly how much visa and company setups cost in USD and how to apply the 9% UAE CT on profits over AED 375,000.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

executive_assistant = Agent(
    role="Project Manager",
    goal="Synthesize the legal and finance reports into a concise, beautiful 'Dubai Relocation Roadmap' and prepare the virtual application forms.",
    backstory="A highly efficient project manager. Specializes in formatting complex data into actionable, professional Markdown roadmaps and simulating automated outreach.",
    verbose=True,
    allow_delegation=False,
    llm=llm
)

# 將 stdout 重新導向以捕捉 CrewAI 的內部日誌，達成「駭客任務即時串流」效果
class LogCapture(io.StringIO):
    def __init__(self, loop, queue: asyncio.Queue):
        super().__init__()
        self.loop = loop
        self.queue = queue

    def write(self, s):
        if s.strip():
            # 推送到 asyncio queue
            asyncio.run_coroutine_threadsafe(
                self.queue.put({"type": "agent_log", "agent": "crewai_system", "msg": s.strip()}), 
                self.loop
            )
        super().write(s)

class OasisCrewOrchestrator:
    async def run(self, user_profile: str) -> AsyncGenerator[dict, None]:
        log_queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        # 任務定義
        task1 = Task(
            description=f"Analyze the following startup profile: '{user_profile}'. Determine if they need a physical warehouse, recommend the best Dubai Free Zone (e.g., IFZA, DMCC), and check Golden Visa eligibility.",
            expected_output="A brief report stating physical space needs, recommended Free Zone, and Golden Visa eligibility.",
            agent=legal_expert
        )

        task2 = Task(
            description="Based on the Legal Expert's Free Zone recommendation, calculate the estimated first-year setup costs (company setup + visa fees in USD). Also, provide a short estimation on the 9% Corporate Tax impact.",
            expected_output="A cost breakdown in USD and a summary of the 9% UAE Corporate Tax impact.",
            agent=finance_specialist
        )

        task3 = Task(
            description="Combine the outputs of the previous tasks into a single 'Dubai Relocation Roadmap' in Traditional Chinese (Markdown). It MUST include: 1. 推薦自貿區與策略, 2. 簽證申請路徑, 3. 財務預估. Finally, add a simulated 'Email/WhatsApp Sent' confirmation at the end.",
            expected_output="A complete, professional Markdown roadmap in Traditional Chinese.",
            agent=executive_assistant
        )

        crew = Crew(
            agents=[legal_expert, finance_specialist, executive_assistant],
            tasks=[task1, task2, task3],
            process=Process.sequential,
            verbose=True
        )

        # 準備攔截 stdout 以串流 Log
        old_stdout = sys.stdout
        sys.stdout = LogCapture(loop, log_queue)

        def _kickoff():
            try:
                return crew.kickoff()
            finally:
                pass

        # 在背景執行 CrewAI (因爲它是 blocking 同步的)
        await log_queue.put({"type": "agent_switch", "agent": "crewai"})
        await log_queue.put({"type": "agent_log", "agent": "crewai", "msg": "[SYSTEM] Initiating Oasis.ai Multi-Agent Crew..."})
        
        task = asyncio.to_thread(_kickoff)

        # 持續讀取 Queue 直到 task 結束
        while not task.done():
            try:
                msg = log_queue.get_nowait()
                yield msg
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.1)

        # 復原 stdout
        sys.stdout = old_stdout

        # 清空剩下的 logs
        while not log_queue.empty():
            yield log_queue.get_nowait()

        result = await task

        yield {
            "type": "result",
            "report": result.raw if hasattr(result, 'raw') else str(result),
            "sources": []
        }
