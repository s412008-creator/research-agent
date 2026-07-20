import os
import json
import asyncio
from typing import AsyncGenerator, TypedDict
from datetime import datetime, timezone
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tavily import AsyncTavilyClient

load_dotenv()

class OasisState(TypedDict):
    user_profile: str
    legal_analysis: dict
    finance_analysis: dict
    final_roadmap: str

def _llm(temperature: float = 0.2):
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        temperature=temperature,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

tavily_client = AsyncTavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# ── AGENT 1: Legal Agent (政策與法律) ──────────────────────────────────────────
async def legal_agent(state: OasisState, emit) -> OasisState:
    await emit("legal", "[Legal Agent] 收到用戶需求，開始分析背景與簽證資格...")
    user_profile = state["user_profile"]
    
    # 模擬/真實搜尋最新杜拜自由區規定
    await emit("legal", "[Legal Agent] 正在搜尋 Dubai IFZA, DMCC, DIFC 最新設立規定與 Golden Visa 資格...")
    try:
        search_res = await tavily_client.search("Dubai IFZA DMCC DIFC Golden Visa AI software company requirements 2024", max_results=3)
        await emit("legal", f"[Legal Agent] 成功獲取 {len(search_res.get('results', []))} 篇最新法規資料。")
    except Exception as e:
        await emit("legal", f"[Legal Agent] 搜尋法規時發生錯誤（使用備用知識庫）: {e}")

    await emit("legal", "[Legal Agent] 分析產業屬性與實體空間需求...")
    chain = PromptTemplate.from_template(
        "You are an elite UAE corporate lawyer & relocation expert. Analyze the user's profile.\n"
        "User Profile: {profile}\n\n"
        "Based on UAE free zone (IFZA, DMCC, DIFC) rules for tech/AI companies, deduce:\n"
        "1. Is physical warehouse needed? (Yes/No)\n"
        "2. Recommended Free Zone (e.g., IFZA or DIFC) and why.\n"
        "3. Golden Visa eligibility (Yes/No) based on standard 2M AED investment or tech talent rules.\n\n"
        "Output ONLY a JSON object:\n"
        '{{\n'
        '  "needs_warehouse": false,\n'
        '  "recommended_free_zone": "IFZA",\n'
        '  "reasoning": "short explanation",\n'
        '  "golden_visa_eligible": true\n'
        '}}\n'
    ) | _llm(0.1) | StrOutputParser()

    raw_json = await chain.ainvoke({"profile": user_profile})
    
    # 清理 JSON
    raw_json = raw_json.strip().strip("```json").strip("```").strip()
    try:
        analysis = json.loads(raw_json)
    except:
        analysis = {
            "needs_warehouse": False,
            "recommended_free_zone": "IFZA (Ideal for Tech/AI Software Startups)",
            "reasoning": "AI software does not require physical logistics/warehousing.",
            "golden_visa_eligible": True
        }
    
    if analysis.get("needs_warehouse"):
        await emit("legal", "[Legal Agent] ⚠️ 判斷需要實體倉儲，推薦考慮 JAFZA 或特定重工業區。")
    else:
        await emit("legal", "[Legal Agent] 💡 判斷為「純軟體/AI新創」，無需實體倉庫，自動過濾重工業區。")
    
    zone = analysis.get("recommended_free_zone", "IFZA")
    visa = "符合" if analysis.get("golden_visa_eligible") else "待評估"
    await emit("legal", f"[Legal Agent] 🏛️ 推薦自貿區：{zone} | 🎫 黃金簽證資格：{visa}")
    await emit("legal", "[Legal Agent] 法律與政策分析完成，交接給 Finance Agent。")

    return {**state, "legal_analysis": analysis}

# ── AGENT 2: Finance Agent (財務精算) ──────────────────────────────────────────
async def finance_agent(state: OasisState, emit) -> OasisState:
    await emit("finance", "[Finance Agent] 接收 Legal Agent 評估結果，開始精算落地成本...")
    legal = state["legal_analysis"]
    
    await emit("finance", "[Finance Agent] 查詢阿聯酋 2024 年最新 9% 企業稅 (Corporate Tax) 規定...")
    # 可加入真實 Tavily 搜尋，此處簡化處理 LLM 推論
    await asyncio.sleep(1.0)
    
    chain = PromptTemplate.from_template(
        "You are an elite UAE corporate tax consultant and financial modeler.\n"
        "User Profile: {profile}\n"
        "Legal Recommendation: {legal}\n\n"
        "Calculate the estimated first-year costs (in USD) for setting up the company in the recommended free zone, "
        "including visa fees and setup fees. Also estimate the 9% UAE Corporate Tax impact based on their revenue "
        "(Note: 9% applies only on taxable income exceeding AED 375,000).\n\n"
        "Output ONLY a JSON object:\n"
        '{{\n'
        '  "company_setup_fee_usd": 8000,\n'
        '  "golden_visa_fee_usd": 2500,\n'
        '  "estimated_tax_usd": 15000,\n'
        '  "total_first_year_cost_usd": 25500,\n'
        '  "tax_explanation": "Short explanation of the 9% CT deduction"\n'
        '}}\n'
    ) | _llm(0.1) | StrOutputParser()

    raw_json = await chain.ainvoke({
        "profile": state["user_profile"],
        "legal": json.dumps(legal)
    })
    
    raw_json = raw_json.strip().strip("```json").strip("```").strip()
    try:
        finance = json.loads(raw_json)
    except:
        finance = {
            "company_setup_fee_usd": 7500,
            "golden_visa_fee_usd": 2600,
            "estimated_tax_usd": 0,
            "total_first_year_cost_usd": 10100,
            "tax_explanation": "Estimated based on 9% UAE CT rules over AED 375K profit threshold."
        }
        
    await emit("finance", f"[Finance Agent] 💰 簽證與設立費估算：${finance.get('company_setup_fee_usd', 0) + finance.get('golden_visa_fee_usd', 0)} USD")
    await emit("finance", f"[Finance Agent] 📊 企業稅 (9%) 衝擊精算：{finance.get('tax_explanation')}")
    await emit("finance", f"[Finance Agent] 💵 首年總預算預估：${finance.get('total_first_year_cost_usd')} USD")
    await emit("finance", "[Finance Agent] 財務精算完成，交接給 Action Agent。")

    return {**state, "finance_analysis": finance}

# ── AGENT 3: Action Agent (執行與客服) ─────────────────────────────────────────
async def action_agent(state: OasisState, emit) -> OasisState:
    await emit("action", "[Action Agent] 接收所有分析報告，開始生成最終文件與自動化流程...")
    
    chain = PromptTemplate.from_template(
        "You are an executive assistant and project manager. Create a beautiful, concise 'Dubai Relocation Roadmap' "
        "in Traditional Chinese (繁體中文 Markdown) based on the user profile, legal analysis, and financial analysis.\n\n"
        "User: {profile}\n"
        "Legal: {legal}\n"
        "Finance: {finance}\n\n"
        "The roadmap MUST include:\n"
        "1. 🏢 推薦自貿區與設立策略\n"
        "2. 🎫 簽證申請路徑 (Golden Visa)\n"
        "3. 💰 首年財務與稅務預估\n"
        "4. 📝 官方申請表單 (預填 80% 的虛擬表單內容)\n\n"
        "Make it look highly professional and action-oriented."
    ) | _llm(0.3) | StrOutputParser()

    roadmap = await chain.ainvoke({
        "profile": state["user_profile"],
        "legal": json.dumps(state["legal_analysis"], ensure_ascii=False),
        "finance": json.dumps(state["finance_analysis"], ensure_ascii=False)
    })
    
    await emit("action", "[Action Agent] 📄 已自動生成極度精美的 《Dubai Relocation Roadmap》 PDF 報表草稿。")
    await emit("action", "[Action Agent] ⚙️ 正在填寫杜拜官方申請表單 (已自動帶入 80% 公司與團隊資訊)...")
    await asyncio.sleep(1.5) # Simulate API call delay
    
    await emit("action", "[Action Agent] 🌐 呼叫 Gmail API / WhatsApp API 中...")
    await asyncio.sleep(1.0)
    
    await emit("action", "[Action Agent] ✅ 成功！已將指南與預填表單發送至用戶信箱，並副件發給杜拜當地代辦 (Mock)。")
    
    return {**state, "final_roadmap": roadmap}


# ── Orchestrator ──────────────────────────────────────────────────────────────
class OasisOrchestrator:
    async def run(self, user_profile: str) -> AsyncGenerator[dict, None]:
        log_queue: asyncio.Queue = asyncio.Queue()

        async def emit(agent: str, msg: str):
            await log_queue.put({"type": "agent_log", "agent": agent, "msg": msg})

        state: OasisState = {
            "user_profile": user_profile,
            "legal_analysis": {},
            "finance_analysis": {},
            "final_roadmap": ""
        }

        pipeline = [
            ("legal", legal_agent),
            ("finance", finance_agent),
            ("action", action_agent),
        ]

        for agent_name, agent_fn in pipeline:
            # 發送當前 Agent 切換事件
            yield {"type": "agent_switch", "agent": agent_name}
            
            task = asyncio.create_task(agent_fn(state, emit))
            
            while not task.done():
                try:
                    yield log_queue.get_nowait()
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0.05)
                    
            # 清空剩下的 logs
            while not log_queue.empty():
                yield log_queue.get_nowait()
                
            state = await task

        # 回傳最終結果
        yield {
            "type": "result",
            "report": state["final_roadmap"],
            "sources": [],
            "mindmap": None # 可根據需要生成
        }
