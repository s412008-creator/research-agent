/* ═══════════════════════════════════════════════════════════
   Research Agent — app.js
   All English. No emojis. Cloudflare Pages ready.
   ═══════════════════════════════════════════════════════════ */

"use strict";

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEYS = {
  gemini:     "ra_gemini_key",
  tavily:     "ra_tavily_key",
  maxSources: "ra_max_sources",
};

const GEMINI_MODEL   = "gemini-1.5-pro";
const GEMINI_BASEURL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TAVILY_SEARCH  = "https://api.tavily.com/search";

// ── Utility ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const qs   = (sel, ctx = document) => ctx.querySelector(sel);

function getSettings() {
  return {
    gemini:     localStorage.getItem(STORAGE_KEYS.gemini)     || "",
    tavily:     localStorage.getItem(STORAGE_KEYS.tavily)     || "",
    maxSources: parseInt(localStorage.getItem(STORAGE_KEYS.maxSources) || "3", 10),
  };
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEYS.gemini,     s.gemini);
  localStorage.setItem(STORAGE_KEYS.tavily,     s.tavily);
  localStorage.setItem(STORAGE_KEYS.maxSources, s.maxSources);
}

function showToast(msg, duration = 3000) {
  const toast = $("toast");
  $("toast-message").textContent = msg;
  show(toast);
  setTimeout(() => hide(toast), duration);
}

// ── Gemini API ────────────────────────────────────────────
class GeminiAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async generate(prompt, temperature = 0.3, maxTokens = 8192) {
    const url  = `${GEMINI_BASEURL}?key=${this.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };

    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`Gemini: ${data.error.message}`);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text.");
    return text;
  }
}

// ── Tavily API ────────────────────────────────────────────
class TavilyAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async search(query, maxResults = 5) {
    const body = {
      api_key:             this.apiKey,
      query,
      search_depth:        "advanced",
      max_results:         maxResults,
      include_raw_content: true,
      include_answer:      true,
    };

    const res = await fetch(TAVILY_SEARCH, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Tavily API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return (data.results || []).map((r) => ({
      title:       r.title       || "Untitled",
      url:         r.url         || "",
      content:     r.content     || "",
      fullContent: r.raw_content || r.content || "",
      score:       r.score       || 0,
    }));
  }
}

// ── Research Agent ────────────────────────────────────────
class ResearchAgent {
  constructor(geminiKey, tavilyKey, maxSources = 3) {
    this.gemini     = new GeminiAPI(geminiKey);
    this.tavily     = new TavilyAPI(tavilyKey);
    this.maxSources = maxSources;
    this.cancelled  = false;
  }

  cancel() { this.cancelled = true; }

  async generateQueries(topic) {
    const prompt = `Generate exactly 4 different English search query strings to thoroughly research the following topic.
Output only the 4 queries, one per line, no numbering, no explanations, no extra text.

Topic: ${topic}`;

    const result = await this.gemini.generate(prompt, 0.2, 256);
    const queries = result
      .split("\n")
      .map((q) => q.trim().replace(/^[\d.\-*]+\s*/, ""))
      .filter((q) => q.length > 5);
    queries.push(topic); // also search original topic
    return queries.slice(0, 5);
  }

  async synthesizeReport(topic, articles) {
    const sources = articles
      .slice(0, 8)
      .map((a, i) => {
        const content = (a.fullContent || a.content).slice(0, 2500);
        return `[Source ${i + 1}] ${a.title}\nURL: ${a.url}\n${content}`;
      })
      .join("\n\n---\n\n");

    const prompt = `You are a senior research analyst. Based on the collected sources below, write a comprehensive deep research report on the topic: "${topic}".

SOURCES:
${sources}

Write a complete, well-structured Markdown report. Include ALL of the following sections:

# ${topic} — Research Report

## Executive Summary
(2-3 sentences capturing the core findings)

## Table of Contents

## Background and Current State
(Context, history, and current status of the topic)

## Core Technology / Key Elements Analysis
(In-depth technical or conceptual breakdown)

## Market Trends and Data
(Key figures, growth rates, market size, statistics with **bold** emphasis)

## Challenges and Opportunities
(Main obstacles and potential upsides)

## Future Outlook
(Data-backed predictions for the next 2-3 years)

## References
(List all cited sources as [Title](URL))

IMPORTANT RULES:
- Write entirely in English. No other language.
- Bold important numbers and data: **bold**
- Cite sources with [Source Title](URL) inline
- Be factual, objective, and comprehensive
- Do not include any emoji characters`;

    return this.gemini.generate(prompt, 0.3, 8192);
  }

  async extractMindMap(topic, report) {
    const prompt = `Extract the key concepts from this research report and output a mind map JSON.

Topic: ${topic}
Report excerpt: ${report.slice(0, 3000)}

Output ONLY valid JSON in exactly this format — no markdown, no explanation, no extra text:
{"center":"${topic}","branches":[{"label":"BranchName","children":["Point1","Point2","Point3"]}]}

Rules:
- Maximum 5 branches
- Maximum 4 children per branch
- All labels in English only
- Each label maximum 25 characters
- Pure JSON output, nothing else`;

    const raw  = await this.gemini.generate(prompt, 0.1, 1024);
    let json = raw.trim();
    if (json.startsWith("```")) {
      json = json.split("\n").slice(1, -1).join("\n");
    }
    return JSON.parse(json);
  }

  async run(topic, onProgress) {
    const log = (msg) => { if (!this.cancelled) onProgress(msg); };

    log("Research Agent starting...");
    log(`Topic: "${topic}"`);
    log("Generating search strategy...");

    // Step 1: Queries
    const queries = await this.generateQueries(topic);
    if (this.cancelled) throw new Error("Cancelled");
    log(`Generated ${queries.length} search queries`);
    queries.forEach((q, i) => log(`  Query ${i + 1}: ${q}`));

    // Step 2: Search
    log("Searching with Tavily AI...");
    const allArticles = [];
    const seenUrls    = new Set();

    for (let i = 0; i < queries.length; i++) {
      if (this.cancelled) throw new Error("Cancelled");
      log(`[${i + 1}/${queries.length}] Searching: "${queries[i]}"`);
      try {
        const results = await this.tavily.search(queries[i], this.maxSources);
        for (const r of results) {
          if (!seenUrls.has(r.url)) {
            allArticles.push(r);
            seenUrls.add(r.url);
          }
        }
        log(`  Found ${results.length} results (total unique: ${allArticles.length})`);
      } catch (e) {
        log(`  Search failed: ${e.message}`);
      }
    }

    log(`Collected ${allArticles.length} unique articles`);
    if (allArticles.length === 0) throw new Error("No articles found. Check your Tavily API key.");

    // Step 3: Analyze
    log("Gemini 1.5 Pro analyzing sources...");
    log(`Reading ${Math.min(allArticles.length, 8)} articles...`);
    if (this.cancelled) throw new Error("Cancelled");

    const report = await this.synthesizeReport(topic, allArticles);
    if (this.cancelled) throw new Error("Cancelled");

    const wordCount = report.trim().split(/\s+/).length;
    log(`Report generated (${wordCount} words)`);

    // Step 4: Mind Map
    log("Extracting mind map structure...");
    let mindMap = null;
    try {
      mindMap = await this.extractMindMap(topic, report);
      log("Mind map data ready");
    } catch (e) {
      log(`Mind map skipped: ${e.message}`);
    }

    log("Research complete.");

    return { topic, queries, articles: allArticles, report, mindMap };
  }
}

// ── Mind Map Canvas Renderer ──────────────────────────────
class MindMapRenderer {
  constructor(canvas, data) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext("2d");
    this.data    = data;
    this.scale   = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.BRANCH_COLORS = [
      "#6366f1", "#8b5cf6", "#3b82f6",
      "#22c55e", "#f97316",
    ];

    this.resize();
    this.attachEvents();
    this.draw();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = Math.max(520, rect.height || 520);
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.scale(dpr, dpr);
    this.CW = w;
    this.CH = h;
  }

  draw() {
    const { ctx, data, CW, CH, scale, offsetX, offsetY, BRANCH_COLORS } = this;
    ctx.clearRect(0, 0, CW, CH);

    const cx = CW / 2 + offsetX;
    const cy = CH / 2 + offsetY;
    const branches = data.branches || [];
    const count    = branches.length;

    ctx.save();

    // Draw branch lines + nodes
    branches.forEach((branch, i) => {
      const angle  = (2 * Math.PI / count) * i - Math.PI / 2;
      const bDist  = 160 * scale;
      const bx     = cx + bDist * Math.cos(angle);
      const by     = cy + bDist * Math.sin(angle);
      const color  = BRANCH_COLORS[i % BRANCH_COLORS.length];

      // Line: center → branch
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = color + "99";
      ctx.lineWidth   = 2.5 * scale;
      ctx.stroke();

      // Branch node
      const br = 32 * scale;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, 2 * Math.PI);
      ctx.fillStyle = color + "33";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Branch label
      ctx.fillStyle   = "#f0f0ff";
      ctx.font        = `${Math.max(10, 13 * scale)}px Inter, sans-serif`;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      this.wrapText(ctx, branch.label, bx, by, br * 1.8, 14 * scale);

      // Children
      const children = branch.children || [];
      children.forEach((child, j) => {
        const cAngle = angle + (j - (children.length - 1) / 2) * 0.55;
        const cDist  = 120 * scale;
        const childX = bx + cDist * Math.cos(cAngle);
        const childY = by + cDist * Math.sin(cAngle);

        // Line: branch → child
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(childX, childY);
        ctx.strokeStyle = color + "55";
        ctx.lineWidth   = 1.5 * scale;
        ctx.stroke();

        // Child node
        const cr = 24 * scale;
        ctx.beginPath();
        ctx.arc(childX, childY, cr, 0, 2 * Math.PI);
        ctx.fillStyle   = "#161628";
        ctx.fill();
        ctx.strokeStyle = color + "99";
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Child label
        ctx.fillStyle    = color;
        ctx.font         = `${Math.max(9, 11 * scale)}px Inter, sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        this.wrapText(ctx, child, childX, childY, cr * 1.8, 12 * scale);
      });
    });

    // Center node
    const radius = 48 * scale;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, "#8b5cf6");
    grad.addColorStop(1, "#6366f1");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();

    // Center label
    ctx.fillStyle    = "#ffffff";
    ctx.font         = `bold ${Math.max(11, 14 * scale)}px Inter, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    this.wrapText(ctx, data.center, cx, cy, radius * 1.8, 15 * scale);

    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const words  = text.split(" ");
    let line     = "";
    const lines  = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else { line = test; }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  }

  attachEvents() {
    const c = this.canvas;

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale  = Math.min(Math.max(this.scale * delta, 0.3), 3);
      this.draw();
    }, { passive: false });

    c.addEventListener("mousedown", (e) => {
      this.dragging = true;
      this.lastX    = e.clientX;
      this.lastY    = e.clientY;
    });
    c.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;
      this.offsetX += e.clientX - this.lastX;
      this.offsetY += e.clientY - this.lastY;
      this.lastX    = e.clientX;
      this.lastY    = e.clientY;
      this.draw();
    });
    c.addEventListener("mouseup",   () => { this.dragging = false; });
    c.addEventListener("mouseleave", () => { this.dragging = false; });

    // Touch
    let lastTouchDist = 0;
    c.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this.dragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    c.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.dragging) {
        this.offsetX += e.touches[0].clientX - this.lastX;
        this.offsetY += e.touches[0].clientY - this.lastY;
        this.lastX    = e.touches[0].clientX;
        this.lastY    = e.touches[0].clientY;
        this.draw();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.scale = Math.min(Math.max(this.scale * (dist / lastTouchDist), 0.3), 3);
        lastTouchDist = dist;
        this.draw();
      }
    }, { passive: false });
    c.addEventListener("touchend", () => { this.dragging = false; });
  }

  reset() {
    this.scale   = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.draw();
  }

  zoomIn()  { this.scale = Math.min(this.scale * 1.2, 3);   this.draw(); }
  zoomOut() { this.scale = Math.max(this.scale * 0.8, 0.3); this.draw(); }
}

// ── App State ─────────────────────────────────────────────
let currentAgent    = null;
let currentResult   = null;
let mindMapRenderer = null;

// ── Section Helpers ───────────────────────────────────────
function showSection(id) {
  ["hero-section", "progress-section", "results-section"].forEach((s) => {
    hide($(s));
  });
  show($(id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Progress / Step Helpers ────────────────────────────────
let currentStepIndex = 0;
const STEP_IDS = ["step-queries", "step-search", "step-analyze", "step-done"];
const LINE_IDS = ["line-1", "line-2", "line-3"];

function setStep(index) {
  STEP_IDS.forEach((id, i) => {
    const el = $(id);
    el.classList.remove("active", "done");
    if (i < index)  el.classList.add("done");
    if (i === index) el.classList.add("active");
  });
  LINE_IDS.forEach((id, i) => {
    const el = $(id);
    el.classList.toggle("done", i < index);
  });
  currentStepIndex = index;
}

function appendLog(msg) {
  const container = $("log-lines");
  const line      = document.createElement("span");
  line.className  = "log-line";
  line.textContent = msg;
  container.appendChild(line);
  const body = $("log-container");
  body.scrollTop = body.scrollHeight;
}

function clearLog() {
  $("log-lines").innerHTML = "";
}

// ── Progress detection from log messages ──────────────────
function detectStep(msg) {
  const m = msg.toLowerCase();
  if (m.includes("generating") || m.includes("query") || m.includes("strategy")) setStep(0);
  else if (m.includes("searching") || m.includes("search") || m.includes("tavily")) setStep(1);
  else if (m.includes("gemini") || m.includes("analyzing") || m.includes("report")) setStep(2);
  else if (m.includes("complete") || m.includes("mind map data ready")) setStep(3);
}

// ── Run Research ──────────────────────────────────────────
async function runResearch(topic) {
  const settings = getSettings();

  if (!settings.gemini) {
    showToast("Please enter your Gemini API key in Settings.");
    openSettings();
    return;
  }
  if (!settings.tavily) {
    showToast("Please enter your Tavily API key in Settings.");
    openSettings();
    return;
  }

  // Prepare progress UI
  $("progress-topic").textContent = topic;
  clearLog();
  setStep(0);
  show($("cancel-btn"));
  showSection("progress-section");

  currentAgent = new ResearchAgent(settings.gemini, settings.tavily, settings.maxSources);

  try {
    currentResult = await currentAgent.run(topic, (msg) => {
      appendLog(msg);
      detectStep(msg);
    });

    setStep(3);
    renderResults(currentResult);
    showSection("results-section");

  } catch (err) {
    if (err.message === "Cancelled") {
      showToast("Research cancelled.");
      showSection("hero-section");
    } else {
      appendLog(`ERROR: ${err.message}`);
      showToast(`Error: ${err.message}`, 5000);
    }
  } finally {
    currentAgent = null;
  }
}

// ── Render Results ────────────────────────────────────────
function renderResults(result) {
  // Header
  $("results-topic").textContent = result.topic;

  const meta = $("results-meta");
  meta.innerHTML = `
    <span class="meta-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      ${result.articles.length} articles analyzed
    </span>
    <span class="meta-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${result.report.trim().split(/\s+/).length} words
    </span>
    <span class="meta-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      ${result.queries.length} search queries
    </span>`;

  // Render report tab (markdown)
  const reportEl = $("report-content");
  if (typeof marked !== "undefined") {
    reportEl.innerHTML = marked.parse(result.report);
  } else {
    reportEl.innerHTML = `<pre style="white-space:pre-wrap">${result.report}</pre>`;
  }

  // Render sources tab
  const queriesEl = $("queries-block");
  queriesEl.innerHTML = `
    <p class="sources-section-title">Search Queries</p>
    <div class="query-chip-row">
      ${result.queries.map((q) => `<span class="query-chip">${q}</span>`).join("")}
    </div>`;

  const articlesEl = $("articles-block");
  articlesEl.innerHTML = `
    <p class="sources-section-title">Analyzed Articles (${result.articles.length})</p>
    <div class="articles-list">
      ${result.articles.map((a) => `
        <div class="article-card">
          <div class="article-title">${a.title}</div>
          <div class="article-url"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a></div>
          <div class="article-snippet">${a.content}</div>
          <span class="article-score">Score: ${(a.score * 100).toFixed(0)}%</span>
        </div>`).join("")}
    </div>`;

  // Render mind map tab
  if (result.mindMap) {
    const canvas = $("mindmap-canvas");
    setTimeout(() => {
      mindMapRenderer = new MindMapRenderer(canvas, result.mindMap);
    }, 100);
  }
}

// ── Tab Switching ─────────────────────────────────────────
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    const panel = $(`panel-${tab}`);
    panel.classList.remove("hidden");
    panel.classList.add("active");

    if (tab === "mindmap" && mindMapRenderer) {
      setTimeout(() => { mindMapRenderer.resize(); mindMapRenderer.draw(); }, 50);
    }
  });
});

// ── Settings Modal ────────────────────────────────────────
function openSettings() {
  const settings = getSettings();
  $("gemini-key-input").value    = settings.gemini;
  $("tavily-key-input").value    = settings.tavily;
  $("max-sources-input").value   = settings.maxSources;
  $("max-sources-value").textContent = settings.maxSources;
  show($("settings-modal"));
}

$("settings-btn").addEventListener("click", openSettings);

$("max-sources-input").addEventListener("input", (e) => {
  $("max-sources-value").textContent = e.target.value;
});

$("modal-save").addEventListener("click", () => {
  const s = {
    gemini:     $("gemini-key-input").value.trim(),
    tavily:     $("tavily-key-input").value.trim(),
    maxSources: parseInt($("max-sources-input").value, 10),
  };
  saveSettings(s);
  hide($("settings-modal"));
  showToast("Settings saved.");
});

$("modal-cancel").addEventListener("click", () => hide($("settings-modal")));
$("modal-close").addEventListener("click",  () => hide($("settings-modal")));
$("settings-modal").addEventListener("click", (e) => {
  if (e.target === $("settings-modal")) hide($("settings-modal"));
});

// ── Start Research ────────────────────────────────────────
function handleStart() {
  const topic = $("topic-input").value.trim();
  if (!topic) {
    showToast("Please enter a research topic.");
    $("topic-input").focus();
    return;
  }
  runResearch(topic);
}

$("start-btn").addEventListener("click", handleStart);
$("topic-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleStart();
});

// ── Cancel ────────────────────────────────────────────────
$("cancel-btn").addEventListener("click", () => {
  if (currentAgent) currentAgent.cancel();
});

// ── Example Chips ─────────────────────────────────────────
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $("topic-input").value = chip.dataset.topic;
    $("topic-input").focus();
  });
});

// ── New Research ──────────────────────────────────────────
$("new-research-btn").addEventListener("click", () => {
  $("topic-input").value = "";
  currentResult   = null;
  mindMapRenderer = null;
  showSection("hero-section");

  // Reset tabs
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.remove("active");
    p.classList.add("hidden");
  });
  qs("[data-tab='report']").classList.add("active");
  $("panel-report").classList.remove("hidden");
  $("panel-report").classList.add("active");
});

// ── Nav Home ──────────────────────────────────────────────
$("nav-home-btn").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("hero-section");
});

// ── Download Report ───────────────────────────────────────
$("download-btn").addEventListener("click", () => {
  if (!currentResult) return;
  const blob = new Blob([currentResult.report], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `research-${currentResult.topic.replace(/\s+/g, "-").slice(0, 40)}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Report downloaded.");
});

// ── Mind Map Controls ─────────────────────────────────────
$("mm-zoom-in").addEventListener("click",  () => mindMapRenderer?.zoomIn());
$("mm-zoom-out").addEventListener("click", () => mindMapRenderer?.zoomOut());
$("mm-reset").addEventListener("click",   () => mindMapRenderer?.reset());

// ── Pre-fill keys if already saved ───────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const settings = getSettings();
  if (!settings.gemini || !settings.tavily) {
    // First visit — auto-open settings
    setTimeout(() => openSettings(), 600);
  }
});
