// GeminiService.swift
// Research Agent iOS App
// Google Gemini 1.5 Pro API Integration

import Foundation

actor GeminiService {
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 180
        self.session = URLSession(configuration: config)
    }

    // MARK: - Core Generate Function

    func generate(prompt: String, temperature: Double = 0.3) async throws -> String {
        var request = URLRequest(url: APIConfig.geminiEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = GeminiRequest(prompt: prompt, temperature: temperature)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ResearchError.networkError("無效的伺服器回應")
        }

        guard httpResponse.statusCode == 200 else {
            let errorText = String(data: data, encoding: .utf8) ?? "未知錯誤"
            throw ResearchError.apiError("Gemini API 錯誤 (\(httpResponse.statusCode)): \(errorText)")
        }

        let geminiResponse = try JSONDecoder().decode(GeminiResponse.self, from: data)

        if let error = geminiResponse.error {
            throw ResearchError.apiError("Gemini: \(error.message)")
        }

        guard let text = geminiResponse.candidates?.first?.content.parts.first?.text else {
            throw ResearchError.apiError("Gemini 未回傳任何文字")
        }

        return text
    }

    // MARK: - Generate Search Queries

    func generateSearchQueries(for topic: String) async throws -> [String] {
        let prompt = """
請根據以下研究主題，生成 4 個不同角度的英文搜尋查詢語句，用於搜尋最新資訊。

研究主題：\(topic)

要求：
- 每個查詢語句針對不同面向（技術、市場、趨勢、挑戰）
- 使用英文
- 直接輸出查詢語句，每行一個，不需要編號或解釋
- 只輸出查詢語句，不要有其他文字
"""
        let result = try await generate(prompt: prompt, temperature: 0.2)
        let queries = result
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        var allQueries = Array(queries.prefix(4))
        allQueries.append(topic) // Add original Chinese topic too
        return allQueries
    }

    // MARK: - Synthesize Research Report

    func synthesizeReport(topic: String, articles: [Article]) async throws -> String {
        let articlesText = articles.enumerated().map { (index, article) in
            """
---
【來源 \(index + 1)】\(article.title)
URL: \(article.url)
內容：
\(String((article.fullContent.isEmpty ? article.content : article.fullContent).prefix(2500)))
"""
        }.joined(separator: "\n")

        let prompt = """
你是一位頂尖研究分析師。請根據以下蒐集到的資料，撰寫一份關於「\(topic)」的深度研究報告。

## 資料來源：
\(articlesText)

## 報告格式（Markdown）：

請撰寫包含以下章節的完整報告：

# \(topic) - 深度研究報告

## 📋 執行摘要
（100字以內的核心洞察）

## 📑 目錄

## 🌍 背景與現況
（發展背景、目前狀態）

## 🔬 核心技術 / 要素分析
（深入分析關鍵要素）

## 📈 市場趨勢與數據
（重要數字、成長率、預測）

## ⚡ 主要挑戰與機會
（問題點與潛在機遇）

## 🌟 未來展望
（未來 2-3 年預測）

## 📚 參考資料
（列出引用來源）

特別要求：
- 使用繁體中文
- 重要數據用 **粗體** 標示
- 論點要引用來源
- 確保內容準確、客觀
"""
        return try await generate(prompt: prompt, temperature: 0.3, maxTokens: 8192)
    }

    // MARK: - Extract Mind Map Data

    func extractMindMapData(topic: String, report: String) async throws -> MindMapData {
        let prompt = """
從以下研究報告中，萃取關鍵概念，生成心智圖的 JSON 結構。

研究主題：\(topic)

報告（部分）：
\(String(report.prefix(3000)))

請只輸出以下 JSON 格式，不要有任何其他文字、說明或 markdown：
{"center":"\(topic)","branches":[{"label":"分支名稱","children":["要點1","要點2","要點3"]},{"label":"分支名稱2","children":["要點1","要點2"]}]}

要求：
- 最多 5 個主要分支
- 每個分支最多 4 個子節點
- 使用繁體中文
- 每個節點不超過 15 字
- 只輸出純 JSON，無其他文字
"""
        let result = try await generate(prompt: prompt, temperature: 0.1)

        // Clean up response and parse JSON
        var jsonStr = result.trimmingCharacters(in: .whitespacesAndNewlines)
        if jsonStr.hasPrefix("```") {
            let lines = jsonStr.split(separator: "\n", omittingEmptySubsequences: false)
            jsonStr = lines.dropFirst().dropLast().joined(separator: "\n")
        }

        guard let jsonData = jsonStr.data(using: .utf8) else {
            throw ResearchError.parseError("心智圖 JSON 解析失敗")
        }

        return try JSONDecoder().decode(MindMapData.self, from: jsonData)
    }
}

// MARK: - Errors

enum ResearchError: LocalizedError {
    case networkError(String)
    case apiError(String)
    case parseError(String)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .networkError(let msg): return "網路錯誤：\(msg)"
        case .apiError(let msg): return "API 錯誤：\(msg)"
        case .parseError(let msg): return "解析錯誤：\(msg)"
        case .cancelled: return "已取消"
        }
    }
}
