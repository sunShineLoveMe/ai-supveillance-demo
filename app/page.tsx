"use client"

import { useEffect, useMemo, useState } from "react"

import { SingleVideoUpload } from "@/components/single-video-upload"
import { MultiResultsDisplay } from "@/components/multi-results-display"
import { SystemLog } from "@/components/system-log"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Languages } from "lucide-react"

export type Language = "zh" | "en"

export type AnalysisResponse = {
  cash_transaction: boolean
  cash_confidence: number
  internal_employee: boolean
  face_similarity: number
  employee_name?: string
  actions: string[]
  objects: string[]
  alert?: boolean
  alert_message?: string
  behavior_confidence?: number
  object_confidence?: number
}

type BaseLogMeta = {
  id: string
  timestamp: string
}

type SystemLogEntry = BaseLogMeta & {
  kind: "system"
  key: "boot" | "cashModule" | "faceModule" | "behaviorModule" | "objectModule"
}

type UploadLogEntry = BaseLogMeta & {
  kind: "upload"
  fileName: string
}

type AnalysisStartLogEntry = BaseLogMeta & {
  kind: "analysis-start"
}

type AnalysisCompleteLogEntry = BaseLogMeta & {
  kind: "analysis-complete"
}

type AnalysisErrorLogEntry = BaseLogMeta & {
  kind: "analysis-error"
  error: string
}

type CashResultLogEntry = BaseLogMeta & {
  kind: "result-cash"
  detected: boolean
  confidence: number
}

type FaceResultLogEntry = BaseLogMeta & {
  kind: "result-face"
  isEmployee: boolean
  similarity: number
  employeeName?: string
}

type BehaviorResultLogEntry = BaseLogMeta & {
  kind: "result-behavior"
  actions: string[]
}

type ObjectResultLogEntry = BaseLogMeta & {
  kind: "result-objects"
  objects: string[]
}

type AlertLogEntry = BaseLogMeta & {
  kind: "alert"
  message: string
}

export type LogEntry =
  | SystemLogEntry
  | UploadLogEntry
  | AnalysisStartLogEntry
  | AnalysisCompleteLogEntry
  | AnalysisErrorLogEntry
  | CashResultLogEntry
  | FaceResultLogEntry
  | BehaviorResultLogEntry
  | ObjectResultLogEntry
  | AlertLogEntry

type LogEntryPayload = Omit<LogEntry, "id" | "timestamp">

type UploadCopy = {
  sectionTitle: string
  sectionDescription: string
  emptyPlaceholder: string
  uploadButton: string
  reuploadButton: string
  analyzeButton: string
  analyzingLabel: string
  dropHint: string
}

type ResultsCopy = {
  heading: string
  cash: {
    title: string
    progressLabel: string
    statuses: {
      highRisk: string
      detected: string
      clear: string
    }
    details: {
      detected: string
      clear: string
    }
  }
  face: {
    title: string
    progressLabel: string
    statuses: {
      employee: string
      visitor: string
    }
    identityLabel: (name?: string) => string
  }
  behavior: {
    title: string
    badgeLabel: (count: number) => string
    confidenceLabel: string
    empty: string
  }
  objects: {
    title: string
    badgeLabel: (count: number) => string
    empty: string
    confidenceLabel: string
  }
}

type SystemLogCopy = {
  heading: string
  rawJsonLabel: string
  timelineLabel: string
  empty: string
}

type LogMessageMap = {
  boot: string
  cashModule: string
  faceModule: string
  behaviorModule: string
  objectModule: string
  uploadSuccess: (fileName: string) => string
  analysisStart: string
  analysisComplete: string
  analysisError: (error: string) => string
  cashDetected: (confidence: number) => string
  cashClear: (confidence: number) => string
  faceEmployee: (similarity: number, name?: string) => string
  faceVisitor: (similarity: number) => string
  behaviorSummary: (actions: string[]) => string
  objectSummary: (count: number) => string
  alertRaised: (message: string) => string
}

type AlertCopy = {
  bannerTitle: string
  bannerDescription: (name?: string) => string
}

type TranslationBundle = {
  title: string
  subtitle: string
  languageToggle: string
  upload: UploadCopy
  results: ResultsCopy
  systemLog: SystemLogCopy
  logs: LogMessageMap
  alert: AlertCopy
}

const translations: Record<Language, TranslationBundle> = {
  zh: {
    title: "AI 智能柜台监控 Demo 系统",
    subtitle: "上传视频后，AI 自动分析四种检测结果",
    languageToggle: "English",
    upload: {
      sectionTitle: "视频上传区",
      sectionDescription: "上传视频后，系统将自动调用四种检测模型进行分析",
      emptyPlaceholder: "暂无视频",
      uploadButton: "上传视频",
      reuploadButton: "重新上传视频",
      analyzeButton: "开始 AI 分析",
      analyzingLabel: "AI 分析中...",
      dropHint: ".mp4 · .mov · 拖拽或点击下方按钮上传",
    },
    results: {
      heading: "AI 分析结果（四种检测）",
      cash: {
        title: "现金交易检测",
        progressLabel: "现金概率",
        statuses: {
          highRisk: "高风险现金交易",
          detected: "检测到现金",
          clear: "未检测到现金",
        },
        details: {
          detected: "系统检测到现金交易迹象，请立即核查相关业务流程。",
          clear: "当前未发现现金交易迹象。",
        },
      },
      face: {
        title: "员工人脸识别",
        progressLabel: "员工匹配度",
        statuses: {
          employee: "识别为内部员工",
          visitor: "识别为访客",
        },
        identityLabel: (name?: string) => `匹配员工：${name ?? "未知"}`,
      },
      behavior: {
        title: "行为分析",
        badgeLabel: (count: number) => `检测到 ${count} 项行为`,
        confidenceLabel: "行为置信度",
        empty: "未检测到异常行为",
      },
      objects: {
        title: "物体检测",
        badgeLabel: (count: number) => `识别 ${count} 个物体`,
        empty: "未识别到物体",
        confidenceLabel: "识别置信度",
      },
    },
    systemLog: {
      heading: "系统日志",
      rawJsonLabel: "AI 返回原始 JSON",
      timelineLabel: "事件时间线",
      empty: "暂无日志记录",
    },
    logs: {
      boot: "系统初始化完成",
      cashModule: "现金交易检测模块已加载",
      faceModule: "员工人脸识别模块已加载",
      behaviorModule: "行为分析模块已加载",
      objectModule: "物体检测模块已加载",
      uploadSuccess: (fileName: string) => `视频 \"${fileName}\" 上传成功`,
      analysisStart: "开始执行 AI 分析",
      analysisComplete: "AI 分析完成",
      analysisError: (error: string) => `AI 分析失败：${error}`,
      cashDetected: (confidence: number) => `现金检测：检测到现金（置信度 ${(confidence * 100).toFixed(1)}%）`,
      cashClear: (confidence: number) => `现金检测：未发现现金（置信度 ${(confidence * 100).toFixed(1)}%）`,
      faceEmployee: (similarity: number, name?: string) =>
        `人脸识别：匹配内部员工${name ? ` ${name}` : ""}（匹配度 ${(similarity * 100).toFixed(1)}%）`,
      faceVisitor: (similarity: number) => `人脸识别：识别为访客（相似度 ${(similarity * 100).toFixed(1)}%）`,
      behaviorSummary: (actions: string[]) => `行为分析：${actions.join(" / ")}`,
      objectSummary: (count: number) => `物体检测：识别 ${count} 个目标`,
      alertRaised: (message: string) => `⚠️ 告警：${message}`,
    },
    alert: {
      bannerTitle: "⚠️ 告警：内部员工现金交易",
      bannerDescription: (name?: string) =>
        `检测到内部员工 ${name ?? "未知员工"} 可能正在进行现金交易，请立即核查。`,
    },
  },
  en: {
    title: "AI Smart Counter Surveillance Demo",
    subtitle: "Upload a video and let AI run four detection pipelines",
    languageToggle: "中文",
    upload: {
      sectionTitle: "Video Upload",
      sectionDescription: "Drop or choose a video to trigger the four AI detection pipelines automatically",
      emptyPlaceholder: "No video uploaded",
      uploadButton: "Upload Video",
      reuploadButton: "Re-upload Video",
      analyzeButton: "Start AI Analysis",
      analyzingLabel: "AI Analyzing...",
      dropHint: ".mp4 · .mov · Drag & drop or use the buttons below",
    },
    results: {
      heading: "AI Analysis Output (Four Detectors)",
      cash: {
        title: "Cash Transaction Detection",
        progressLabel: "Cash Confidence",
        statuses: {
          highRisk: "High-risk cash transaction",
          detected: "Cash detected",
          clear: "No cash detected",
        },
        details: {
          detected: "Potential cash movement detected. Please verify the ongoing operation immediately.",
          clear: "No clear cash activity was detected.",
        },
      },
      face: {
        title: "Employee Face Recognition",
        progressLabel: "Employee Similarity",
        statuses: {
          employee: "Identified as internal staff",
          visitor: "Identified as visitor",
        },
        identityLabel: (name?: string) => `Matched staff: ${name ?? "Unknown"}`,
      },
      behavior: {
        title: "Behavior Analysis",
        badgeLabel: (count: number) => `${count} behaviors detected`,
        confidenceLabel: "Behavior confidence",
        empty: "No suspicious behavior detected",
      },
      objects: {
        title: "Object Detection",
        badgeLabel: (count: number) => `${count} objects recognized`,
        empty: "No objects identified",
        confidenceLabel: "Detection confidence",
      },
    },
    systemLog: {
      heading: "System Log",
      rawJsonLabel: "Raw JSON from AI",
      timelineLabel: "Event timeline",
      empty: "No log entries yet",
    },
    logs: {
      boot: "System bootstrap completed",
      cashModule: "Cash detection module loaded",
      faceModule: "Employee recognition module loaded",
      behaviorModule: "Behavior analysis module loaded",
      objectModule: "Object detection module loaded",
      uploadSuccess: (fileName: string) => `Video \"${fileName}\" uploaded successfully`,
      analysisStart: "AI analysis started",
      analysisComplete: "AI analysis finished",
      analysisError: (error: string) => `AI analysis failed: ${error}`,
      cashDetected: (confidence: number) =>
        `Cash detection: cash detected (confidence ${(confidence * 100).toFixed(1)}%)`,
      cashClear: (confidence: number) =>
        `Cash detection: no cash found (confidence ${(confidence * 100).toFixed(1)}%)`,
      faceEmployee: (similarity: number, name?: string) =>
        `Face recognition: matched employee${name ? ` ${name}` : ""} (similarity ${(similarity * 100).toFixed(1)}%)`,
      faceVisitor: (similarity: number) =>
        `Face recognition: visitor detected (similarity ${(similarity * 100).toFixed(1)}%)`,
      behaviorSummary: (actions: string[]) => `Behavior analysis: ${actions.join(" / ")}`,
      objectSummary: (count: number) => `Object detection: ${count} target(s) identified`,
      alertRaised: (message: string) => `⚠️ Alert: ${message}`,
    },
    alert: {
      bannerTitle: "⚠️ Alert: Internal Cash Transaction",
      bannerDescription: (name?: string) =>
        `Detected a possible cash transaction by employee ${name ?? "Unknown"}. Please verify immediately.`,
    },
  },
}

const fallbackAnalysis: AnalysisResponse = {
  cash_transaction: true,
  cash_confidence: 0.93,
  internal_employee: true,
  face_similarity: 0.88,
  employee_name: "张三",
  actions: ["频繁手部运动", "递交文件", "注视现金区域"],
  objects: ["人物", "柜台", "现金", "文件夹"],
  alert: true,
  alert_message: "⚠️ 检测到内部员工现金交易",
  behavior_confidence: 0.86,
  object_confidence: 0.9,
}

function createLogEntry(entry: LogEntryPayload): LogEntry {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return {
    id,
    timestamp: new Date().toISOString(),
    ...entry,
  } as LogEntry
}

function formatLogEntry(entry: LogEntry, language: Language) {
  const messages = translations[language].logs

  switch (entry.kind) {
    case "system":
      return messages[entry.key]
    case "upload":
      return messages.uploadSuccess(entry.fileName)
    case "analysis-start":
      return messages.analysisStart
    case "analysis-complete":
      return messages.analysisComplete
    case "analysis-error":
      return messages.analysisError(entry.error)
    case "result-cash":
      return entry.detected ? messages.cashDetected(entry.confidence) : messages.cashClear(entry.confidence)
    case "result-face":
      return entry.isEmployee
        ? messages.faceEmployee(entry.similarity, entry.employeeName)
        : messages.faceVisitor(entry.similarity)
    case "result-behavior":
      return messages.behaviorSummary(entry.actions)
    case "result-objects":
      return messages.objectSummary(entry.objects.length)
    case "alert":
      return messages.alertRaised(entry.message)
    default:
      return ""
  }
}

export default function Page() {
  const [language, setLanguage] = useState<Language>("zh")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResponse | null>(null)
  const [rawJson, setRawJson] = useState("")
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const initialEntries: LogEntryPayload[] = [
      { kind: "system", key: "boot" },
      { kind: "system", key: "cashModule" },
      { kind: "system", key: "faceModule" },
      { kind: "system", key: "behaviorModule" },
      { kind: "system", key: "objectModule" },
    ]
    return initialEntries.map((entry) => createLogEntry(entry))
  })

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const ui = translations[language]

  const shouldAlert = useMemo(() => {
    if (!results) return false
    return results.cash_confidence >= 0.9 && results.face_similarity >= 0.85
  }, [results])

  const handleFileUpload = (file: File) => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    setResults(null)
    setRawJson("")
    setLogs((prev) => [...prev, createLogEntry({ kind: "upload", fileName: file.name })])
  }

  const handleAnalyze = async () => {
    if (!videoFile) {
      return
    }

    setIsAnalyzing(true)
    setLogs((prev) => [...prev, createLogEntry({ kind: "analysis-start" })])

    const formData = new FormData()
    formData.append("file", videoFile)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as AnalysisResponse
      setResults(data)
      setRawJson(JSON.stringify(data, null, 2))

      setLogs((prev) => [
        ...prev,
        createLogEntry({ kind: "analysis-complete" }),
        createLogEntry({ kind: "result-cash", detected: data.cash_transaction, confidence: data.cash_confidence }),
        createLogEntry({
          kind: "result-face",
          isEmployee: data.internal_employee,
          similarity: data.face_similarity,
          employeeName: data.employee_name,
        }),
        createLogEntry({ kind: "result-behavior", actions: data.actions }),
        createLogEntry({ kind: "result-objects", objects: data.objects }),
      ])

      if (data.alert || (data.cash_confidence >= 0.9 && data.face_similarity >= 0.85)) {
        const message = data.alert_message ?? ui.alert.bannerTitle
        setLogs((prev) => [...prev, createLogEntry({ kind: "alert", message })])
      }
    } catch (error) {
      const mock = fallbackAnalysis
      setResults(mock)
      setRawJson(JSON.stringify(mock, null, 2))
      const message = error instanceof Error ? error.message : "Unknown error"

      setLogs((prev) => [
        ...prev,
        createLogEntry({ kind: "analysis-error", error: message }),
        createLogEntry({ kind: "analysis-complete" }),
        createLogEntry({ kind: "result-cash", detected: mock.cash_transaction, confidence: mock.cash_confidence }),
        createLogEntry({
          kind: "result-face",
          isEmployee: mock.internal_employee,
          similarity: mock.face_similarity,
          employeeName: mock.employee_name,
        }),
        createLogEntry({ kind: "result-behavior", actions: mock.actions }),
        createLogEntry({ kind: "result-objects", objects: mock.objects }),
      ])

      if (mock.alert || (mock.cash_confidence >= 0.9 && mock.face_similarity >= 0.85)) {
        const messageToUse = mock.alert_message ?? ui.alert.bannerTitle
        setLogs((prev) => [...prev, createLogEntry({ kind: "alert", message: messageToUse })])
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className={`rounded-xl bg-card/40 p-4 shadow-sm transition-all ${shouldAlert ? "animate-alert-surface border border-destructive/40" : "border border-border"}`}>
            <h1 className={`mb-2 text-3xl font-bold tracking-tight sm:text-4xl ${shouldAlert ? "text-destructive" : "text-foreground"}`}>
              {ui.title}
            </h1>
            <p className={`text-base sm:text-lg ${shouldAlert ? "text-destructive/80" : "text-muted-foreground"}`}>{ui.subtitle}</p>
          </div>
          <Button
            variant="outline"
            className="h-10 self-end border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => setLanguage((prev) => (prev === "zh" ? "en" : "zh"))}
          >
            <Languages className="mr-2 h-4 w-4" />
            {ui.languageToggle}
          </Button>
        </header>

        {shouldAlert && results && (
          <div className="mb-6 rounded-lg border-2 border-destructive bg-destructive/10 p-4 shadow-lg animate-alert-ring">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">{ui.alert.bannerTitle}</p>
                <p className="text-sm text-destructive/80">
                  {ui.alert.bannerDescription(results.employee_name)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <SingleVideoUpload
            videoUrl={videoUrl}
            analyzing={isAnalyzing}
            onFileUpload={handleFileUpload}
            onAnalyze={handleAnalyze}
            hasVideo={!!videoFile}
            copy={ui.upload}
          />
        </div>

        {results && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">{ui.results.heading}</h2>
            <MultiResultsDisplay results={results} copy={ui.results} shouldAlert={shouldAlert} />
          </div>
        )}

        <SystemLog
          logs={logs}
          rawJson={rawJson}
          heading={ui.systemLog.heading}
          rawJsonLabel={ui.systemLog.rawJsonLabel}
          timelineLabel={ui.systemLog.timelineLabel}
          emptyLabel={ui.systemLog.empty}
          language={language}
          formatLogEntry={(entry) => formatLogEntry(entry, language)}
        />

        <footer className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © 2025 Zhiyun Tech · AI Surveillance Demo
        </footer>
      </div>
    </div>
  )
}
