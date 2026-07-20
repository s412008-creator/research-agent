    import asyncio
import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from agent_logic import MultiAgentResearchOrchestrator
from oasis_agent import OasisOrchestrator

load_dotenv()

app = FastAPI(title="DeepResearch AI API v2.0 — Multi-Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    topic: str


class FollowupRequest(BaseModel):
    topic: str
    section: str
    question: str


# ── Main Research Endpoint ─────────────────────────────────────────────────────
@app.post("/api/research")
async def generate_research(req: ResearchRequest):
    topic = req.topic.strip()

    async def event_generator():
        orchestrator = MultiAgentResearchOrchestrator()
        try:
            async for event in orchestrator.run(topic):
                payload = json.dumps(event, ensure_ascii=False)
                yield f"data: {payload}\n\n"
                await asyncio.sleep(0.01)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'msg': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Oasis (Dubai Golden Visa) Endpoint ─────────────────────────────────────────
@app.post("/api/oasis")
async def generate_oasis(req: ResearchRequest):
    topic = req.topic.strip()

    async def event_generator():
        orchestrator = OasisOrchestrator()
        try:
            async for event in orchestrator.run(topic):
                payload = json.dumps(event, ensure_ascii=False)
                yield f"data: {payload}\n\n"
                await asyncio.sleep(0.01)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'msg': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ── Follow-up / Deep-dive Endpoint ────────────────────────────────────────────
@app.post("/api/followup")
async def followup(req: FollowupRequest):
    """Re-research only a specific section of an existing report."""
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import PromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from tavily import AsyncTavilyClient

    async def stream():
        try:
            llm = ChatGoogleGenerativeAI(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                temperature=0.3,
                google_api_key=os.getenv("GOOGLE_API_KEY"),
            )
            tavily = AsyncTavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

            yield f"data: {json.dumps({'type': 'agent_log', 'agent': 'research', 'msg': f'🔍 針對追問進行深度搜尋：{req.question}'})}\n\n"

            search_query = f"{req.topic} {req.section} {req.question}"
            res = await tavily.search(search_query, search_depth="advanced", max_results=4)
            sources = res.get("results", [])

            yield f"data: {json.dumps({'type': 'agent_log', 'agent': 'research', 'msg': f'  找到 {len(sources)} 篇新資料，正在分析...'})}\n\n"

            context = "\n\n".join([
                f"[{i+1}] {s.get('title', '')}\nURL: {s.get('url', '')}\n{s.get('content', '')[:1500]}"
                for i, s in enumerate(sources)
            ])

            prompt = PromptTemplate.from_template(
                "You are a research analyst. The user is reading a report about '{topic}' and wants to go deeper on the section '{section}'.\n"
                "Their specific question: {question}\n\n"
                "Based on these fresh search results:\n{context}\n\n"
                "Write a focused, detailed follow-up answer in Traditional Chinese (繁體中文). "
                "Include citations [1], [2], etc. Clearly mark [事實] vs [推測]."
            )
            chain = prompt | llm | StrOutputParser()
            answer = await chain.ainvoke({
                "topic": req.topic,
                "section": req.section,
                "question": req.question,
                "context": context,
            })

            yield f"data: {json.dumps({'type': 'followup_result', 'answer': answer, 'sources': [{'title': s.get('title',''), 'url': s.get('url','')} for s in sources]})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'msg': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
def health():
    return {"status": "DeepResearch AI v2.0 — Multi-Agent Backend Running"}
