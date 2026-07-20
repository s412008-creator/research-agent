"""
Deep Research Agent v2.1
- Critic: all sources evaluated in ONE batch LLM call (quota-safe)
- All output in English
- No emojis in logs
"""
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

from scraper import scrape_and_clean

load_dotenv()


class ResearchState(TypedDict):
    topic: str
    sub_questions: list[str]
    raw_sources: list[dict]
    verified_sources: list[dict]
    report: str


def _llm(temperature: float = 0.2):
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        temperature=temperature,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

tavily_client = AsyncTavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


# ── AGENT 1: Planner ─────────────────────────────────────────────────────────
async def planner_agent(state: ResearchState, emit) -> ResearchState:
    await emit("planner", f"[Planner] Analyzing topic: {state['topic']}")

    chain = PromptTemplate.from_template(
        "You are a senior research strategist. Decompose the following topic into exactly 3 distinct sub-questions "
        "that together cover the full scope.\n"
        "Topic: {topic}\n\n"
        "Output ONLY the 3 sub-questions, one per line, no numbering, no explanations."
    ) | _llm(0.3) | StrOutputParser()

    raw = await chain.ainvoke({"topic": state["topic"]})
    sub_questions = [q.strip() for q in raw.split("\n") if q.strip()][:3]

    for q in sub_questions:
        await emit("planner", f"  [sub-question] {q}")

    await emit("planner", f"[Planner] Done. {len(sub_questions)} sub-questions generated. Handing off to Research Agent.")
    return {**state, "sub_questions": sub_questions}


# ── AGENT 2: Research ─────────────────────────────────────────────────────────
async def research_agent(state: ResearchState, emit) -> ResearchState:
    await emit("research", f"[Research] Launching parallel searches for {len(state['sub_questions'])} sub-questions...")

    async def search_one(question: str) -> list[dict]:
        res = await tavily_client.search(question, search_depth="advanced", max_results=2)
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""),
             "content": r.get("content", ""), "published_date": r.get("published_date", ""),
             "query": question}
            for r in res.get("results", [])
        ]

    results_per_q = await asyncio.gather(*[search_one(q) for q in state["sub_questions"]])

    seen_urls: set[str] = set()
    all_sources: list[dict] = []
    for i, (results, q) in enumerate(zip(results_per_q, state["sub_questions"])):
        await emit("research", f"  [sub-question {i+1}] Found {len(results)} articles")
        for r in results:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                all_sources.append(r)

    top = all_sources[:6]
    await emit("research", f"[Research] Scraping {len(top)} source pages for full content...")
    scraped = await scrape_and_clean([r["url"] for r in top])
    for r in top:
        r["content"] = scraped.get(r["url"], r["content"])

    await emit("research", f"[Research] Done. {len(top)} sources collected. Handing off to Critic Agent.")
    return {**state, "raw_sources": top}


# ── AGENT 3: Critic (BATCH — single LLM call) ────────────────────────────────
async def critic_agent(state: ResearchState, emit) -> ResearchState:
    await emit("critic", f"[Critic] Evaluating {len(state['raw_sources'])} sources in a single batch call...")

    sources = state["raw_sources"]
    current_year = datetime.now(timezone.utc).year

    sources_text = "\n\n".join([
        f"SOURCE {i+1}:\nTitle: {s['title']}\nURL: {s['url']}\n"
        f"Published: {s.get('published_date', 'unknown')}\n"
        f"Content: {s['content'][:800]}"
        for i, s in enumerate(sources)
    ])

    chain = PromptTemplate.from_template(
        "You are a critical fact-checker. Evaluate ALL of the following sources at once for the research topic.\n\n"
        "Research Topic: {topic}\n"
        "Current Year: {current_year}\n\n"
        "{sources_text}\n\n"
        "For EACH source, output a JSON object on a single line (one per line, no array wrapper):\n"
        '{{ "index": 1, "confidence": 0.85, "is_stale": false, "tags": ["Fact", "Research Data"], "key_claim": "short key claim" }}\n\n'
        "Tags must be chosen from: Fact, Prediction, Research Data, Expert Opinion, Official Statement\n"
        "Output ONLY the JSON lines, nothing else."
    ) | _llm(0.1) | StrOutputParser()

    raw_eval = await chain.ainvoke({
        "topic": state["topic"],
        "current_year": current_year,
        "sources_text": sources_text,
    })

    # Parse batch results
    evaluations: dict[int, dict] = {}
    for line in raw_eval.strip().splitlines():
        line = line.strip().strip("```json").strip("```").strip()
        if not line or not line.startswith("{"):
            continue
        try:
            ev = json.loads(line)
            idx = int(ev.get("index", 0))
            evaluations[idx] = ev
        except Exception:
            pass

    verified: list[dict] = []
    for i, s in enumerate(sources):
        ev = evaluations.get(i + 1, {})
        confidence = float(ev.get("confidence", 0.6))
        is_stale = bool(ev.get("is_stale", False))
        tags = ev.get("tags", ["Fact"])
        key_claim = ev.get("key_claim", s["title"])

        confidence_label = "HIGH" if confidence >= 0.75 else "MED" if confidence >= 0.5 else "LOW"
        stale_note = " [possibly stale]" if is_stale else ""
        await emit("critic", f"  Source {i+1}: {confidence_label} ({confidence:.0%}) | {', '.join(tags)}{stale_note}")

        if confidence >= 0.4:
            verified.append({**s, "confidence": confidence, "is_stale": is_stale,
                             "tags": tags, "key_claim": key_claim})

    await emit("critic", f"[Critic] Done. Retained {len(verified)}/{len(sources)} sources. Handing off to Writer Agent.")
    return {**state, "verified_sources": verified}


# ── AGENT 4: Writer ───────────────────────────────────────────────────────────
async def writer_agent(state: ResearchState, emit) -> ResearchState:
    await emit("writer", "[Writer] Synthesizing verified sources into structured report...")

    sources_context = "\n\n".join([
        f"[{i+1}] ({', '.join(s['tags'])}) (Confidence: {s['confidence']:.0%}"
        f"{'  [possibly stale]' if s.get('is_stale') else ''})\n"
        f"Title: {s['title']}\nURL: {s['url']}\n"
        f"Key claim: {s['key_claim']}\n"
        f"Content: {s['content'][:2000]}"
        for i, s in enumerate(state["verified_sources"])
    ])

    chain = PromptTemplate.from_template(
        "You are an elite research analyst. Write a comprehensive research report in ENGLISH.\n\n"
        "Topic: {topic}\n\n"
        "Verified Sources:\n{sources_context}\n\n"
        "Rules:\n"
        "1. After each factual claim, add inline citation like [1] matching the source number.\n"
        "2. Mark predictions with [Prediction] and facts with [Fact].\n"
        "3. If a source is stale, add [stale] after its citation.\n"
        "4. Executive Summary MUST be strictly under 100 words (3-4 sentences max).\n"
        "5. Key Findings MUST be a bulleted list. Each bullet must start with a short title (bolded) followed by a colon or dash, and the description must be 2-3 sentences max.\n\n"
        "Write EXACTLY these sections:\n"
        "## Executive Summary\n"
        "## Key Findings\n"
        "## Deep Analysis\n"
        "## Technology Timeline\n"
        "```mermaid\ngantt\n    title {topic} Timeline\n    dateFormat YYYY\n    ...\n```\n"
        "## Comparison Table\n"
        "(Markdown table comparing key players or approaches)\n"
        "## Outlook & Risks\n"
        "## References\n"
        "(Numbered list with clickable URLs and confidence scores)\n"
    ) | _llm(0.4) | StrOutputParser()

    report = await chain.ainvoke({
        "topic": state["topic"],
        "sources_context": sources_context,
    })

    await emit("writer", "[Writer] Done. Report generated with citations and timeline.")
    return {**state, "report": report}

# ── AGENT 5: Mindmap ──────────────────────────────────────────────────────────
async def mindmap_agent(state: ResearchState, emit) -> ResearchState:
    await emit("mindmap", "[Mindmap] Generating JSON mind map structure...")
    
    chain = PromptTemplate.from_template(
        "You are a structural analyst. Extract the key concepts from the research report and format them as a JSON mind map.\n\n"
        "Topic: {topic}\n\n"
        "Report:\n{report}\n\n"
        "Output a pure JSON object with this exact structure:\n"
        '{{\n'
        '  "center": "Short Central Topic",\n'
        '  "branches": [\n'
        '    {{\n'
        '      "label": "Main Branch",\n'
        '      "children": [\n'
        '        {{ "label": "Child Node" }}\n'
        '      ]\n'
        '    }}\n'
        '  ]\n'
        '}}\n\n'
        "CRITICAL RULES:\n"
        "1. Every label MUST be short keywords, MAXIMUM 12-15 Chinese characters or 4-6 English words.\n"
        "2. Max 6 branches, max 4 children per branch.\n"
        "3. Output ONLY valid JSON inside a ```json block."
    ) | _llm(0.1) | StrOutputParser()
    
    raw = await chain.ainvoke({
        "topic": state["topic"],
        "report": state["report"][:4000] # limit length
    })
    
    # parse JSON
    raw = raw.strip().strip("```json").strip("```").strip()
    try:
        import json
        mindmap_data = json.loads(raw)
    except Exception:
        mindmap_data = {"center": state["topic"], "branches": []}
        
    await emit("mindmap", "[Mindmap] Done. Mind map structure generated.")
    return {**state, "mindmap": mindmap_data}


# ── Orchestrator ──────────────────────────────────────────────────────────────
class MultiAgentResearchOrchestrator:
    async def run(self, topic: str) -> AsyncGenerator[dict, None]:
        if topic.strip().upper() == "TEST":
            # --- MOCK MODE FOR TESTING UI ---
            yield {"type": "agent_switch", "agent": "planner"}
            yield {"type": "agent_log", "agent": "planner", "msg": "[Planner] Analyzing mock topic..."}
            await asyncio.sleep(1)
            
            yield {"type": "agent_switch", "agent": "research"}
            yield {"type": "agent_log", "agent": "research", "msg": "[Research] Simulating parallel searches..."}
            await asyncio.sleep(1.5)
            
            yield {"type": "agent_switch", "agent": "critic"}
            yield {"type": "agent_log", "agent": "critic", "msg": "[Critic] Evaluating sources..."}
            await asyncio.sleep(1)
            
            yield {"type": "agent_switch", "agent": "writer"}
            yield {"type": "agent_log", "agent": "writer", "msg": "[Writer] Generating mock report..."}
            await asyncio.sleep(1.5)
            
            yield {"type": "agent_switch", "agent": "mindmap"}
            yield {"type": "agent_log", "agent": "mindmap", "msg": "[Mindmap] Generating JSON mind map structure..."}
            await asyncio.sleep(1)

            mock_report = (
                "## Executive Summary\n"
                "This is a mock executive summary generated for testing purposes. It demonstrates the new card-based layout with proper padding and background colors. The summary is strictly constrained to prevent overwhelming the user with text.\n\n"
                "## Key Findings\n"
                "* **Rapid Growth**: The market is experiencing unprecedented growth, reaching a valuation of USD 1.5 billion in 2025 [1]. This trend is expected to continue with a 25.5% CAGR [Prediction].\n"
                "* **Technological Shifts**: New paradigms are shifting the landscape, causing legacy systems to become obsolete [Fact] [2].\n"
                "* **Global Adoption**: North America and APAC regions are leading the adoption curve [Fact].\n\n"
                "## Deep Analysis\n"
                "The fundamental drivers of this industry include advanced algorithms and cheap compute power. Analysts note a 40% reduction in costs over two years [3].\n\n"
                "## Timeline\n"
                "```gantt\n"
                "title Industry Evolution\n"
                "dateFormat YYYY-MM\n"
                "section Key Milestones\n"
                "Initial Breakthrough :2023-01, 2023-06\n"
                "Mass Adoption :2024-05, 2024-12\n"
                "section Future Projections\n"
                "AGI Achieved :2026-01, 2026-12\n"
                "```\n\n"
                "## Outlook & Risks\n"
                "The primary risks include regulatory challenges and hardware supply chain constraints [Prediction].\n\n"
                "## References\n"
                "1. Mock Source Alpha\n"
                "2. Mock Source Beta\n"
                "3. Mock Source Gamma\n"
            )
            mock_sources = [
                {"title": "Mock Source Alpha", "url": "https://example.com/alpha", "confidence": 0.95, "tags": ["Fact", "Research Data"], "is_stale": False},
                {"title": "Mock Source Beta", "url": "https://example.com/beta", "confidence": 0.82, "tags": ["Expert Opinion"], "is_stale": False},
                {"title": "Mock Source Gamma", "url": "https://example.com/gamma", "confidence": 0.76, "tags": ["Prediction"], "is_stale": True},
            ]
            mock_mindmap = {
                "center": "Mock Test Topic",
                "branches": [
                    {"label": "Growth", "children": [{"label": "USD 1.5B"}, {"label": "25.5% CAGR"}]},
                    {"label": "Technology", "children": [{"label": "Algorithms"}, {"label": "Compute"}]},
                    {"label": "Regions", "children": [{"label": "North America"}, {"label": "APAC"}]}
                ]
            }

            yield {
                "type": "result",
                "report": mock_report,
                "sources": mock_sources,
                "mindmap": mock_mindmap
            }
            return
        log_queue: asyncio.Queue = asyncio.Queue()

        async def emit(agent: str, msg: str):
            await log_queue.put({"type": "agent_log", "agent": agent, "msg": msg})

        state: ResearchState = {
            "topic": topic, "sub_questions": [],
            "raw_sources": [], "verified_sources": [], "report": "",
        }

        pipeline = [
            ("planner",  planner_agent),
            ("research", research_agent),
            ("critic",   critic_agent),
            ("writer",   writer_agent),
            ("mindmap",  mindmap_agent),
        ]

        for agent_name, agent_fn in pipeline:
            yield {"type": "agent_switch", "agent": agent_name}
            task = asyncio.create_task(agent_fn(state, emit))
            while not task.done():
                try:
                    yield log_queue.get_nowait()
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0.05)
            while not log_queue.empty():
                yield log_queue.get_nowait()
            state = await task

        yield {
            "type": "result",
            "report": state["report"],
            "sources": [
                {"title": s["title"], "url": s["url"],
                 "confidence": s["confidence"], "tags": s["tags"],
                 "is_stale": s.get("is_stale", False)}
                for s in state["verified_sources"]
            ],
            "mindmap": state.get("mindmap")
        }
