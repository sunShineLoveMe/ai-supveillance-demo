"use client"

import { useEffect, useMemo, useState } from "react"

import { SingleVideoUpload } from "@/components/single-video-upload"
import { MultiResultsDisplay } from "@/components/multi-results-display"
import { SystemLog } from "@/components/system-log"
import { AlertTriangle } from "lucide-react"

export type Language = "zh"

export type MatchSummary = {
  name?: string | null
  similarity: number
}

export type CashKeyframe = {
  frame_index: number
  timestamp_ms: number
  image_base64?: string
  mime_type?: string
  detections: {
    label: string
    raw_label?: string
    confidence: number
    box: number[]
    match?: MatchSummary
    is_cash?: boolean
  }[]
  match?: MatchSummary
  contains_cash?: boolean
}

export type FrameSamplingMeta = {
  fps: number
  total_frames: number
  duration_seconds: number
  processed_frames: number
  sample_interval_frames: number
  generated_at: string
}

export type AnalysisResponse = {
  cash_transaction: boolean
  cash_confidence: number
  internal_employee: boolean
  face_similarity: number
  employee_name?: string
  employee_match_score?: number
  actions: string[]
  objects: string[]
  alert?: boolean
  alert_message?: string
  behavior_confidence?: number
  object_confidence?: number
  cash_keyframes?: CashKeyframe[]
  employee_keyframes?: CashKeyframe[]
  frame_sampling?: FrameSamplingMeta
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
    keyframesTitle: string
    keyframesEmpty: string
    previewUnavailable: string
    detectionsLabel: string
    viewLargerLabel: string
    dialogTitle: string
    dialogTimestampLabel: string
    dialogFrameLabel: string
  }
  face: {
    title: string
    progressLabel: string
    statuses: {
      employee: string
      visitor: string
    }
    identityLabel: (matched: boolean, name?: string | null) => string
    matchSummaryLabel: string
    matchUnknownLabel: string
    dialogMatchLabel: string
    keyframesTitle: string
    keyframesEmpty: string
    previewUnavailable: string
    detectionsLabel: string
    viewLargerLabel: string
    dialogTitle: string
    dialogTimestampLabel: string
    dialogFrameLabel: string
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
  samplingLabel: string
  samplingEmpty: string
  samplingItems: {
    fps: string
    totalFrames: string
    duration: string
    processed: string
    interval: string
    generatedAt: string
  }
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
  upload: UploadCopy
  results: ResultsCopy
  systemLog: SystemLogCopy
  logs: LogMessageMap
  alert: AlertCopy
}

const translations: Record<Language, TranslationBundle> = {
  zh: {
    title: "柜台现金交易监控告警系统（模拟）",
    subtitle: "上传视频后，系统自动分析检测结果",
    upload: {
      sectionTitle: "视频上传区",
      sectionDescription: "上传视频后，系统自动分析检测结果",
      emptyPlaceholder: "暂无视频",
      uploadButton: "上传视频",
      reuploadButton: "重新上传视频",
      analyzeButton: "开始算法分析",
      analyzingLabel: "模型分析中...",
      dropHint: ".mp4 · .mov · 拖拽或点击下方按钮上传",
    },
    results: {
      heading: "分析结果",
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
        keyframesTitle: "疑似现金关键帧",
        keyframesEmpty: "暂无关键帧截图",
        previewUnavailable: "暂无预览",
        detectionsLabel: "检测标签",
        viewLargerLabel: "点击放大查看",
        dialogTitle: "关键帧详情",
        dialogTimestampLabel: "时间戳",
        dialogFrameLabel: "帧编号",
      },
      face: {
        title: "员工人脸识别",
        progressLabel: "员工匹配度",
        statuses: {
          employee: "识别为内部员工",
          visitor: "识别为访客",
        },
        identityLabel: (matched: boolean, name?: string | null) =>
          matched ? `匹配员工：${name ?? "未知"}` : "未匹配到内部员工",
        matchSummaryLabel: "匹配结果",
        matchUnknownLabel: "未匹配到样本",
        dialogMatchLabel: "匹配结果",
        keyframesTitle: "疑似员工关键帧",
        keyframesEmpty: "暂无员工关键帧截图",
        previewUnavailable: "暂无预览",
        detectionsLabel: "检测标签",
        viewLargerLabel: "点击放大查看",
        dialogTitle: "人脸关键帧详情",
        dialogTimestampLabel: "时间戳",
        dialogFrameLabel: "帧编号",
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
      samplingLabel: "帧采样统计",
      samplingEmpty: "暂无帧采样数据",
      samplingItems: {
        fps: "采样帧率 (FPS)",
        totalFrames: "视频总帧数",
        duration: "视频时长",
        processed: "参与分析的帧数",
        interval: "采样间隔 (帧)",
        generatedAt: "生成时间",
      },
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
}

function createFallbackAnalysis(): AnalysisResponse {
  return {
    cash_transaction: true,
    cash_confidence: 0.93,
    internal_employee: true,
    face_similarity: 0.88,
    employee_name: "张三",
    employee_match_score: 0.66,
    actions: ["频繁手部运动", "递交文件", "注视现金区域"],
    objects: ["Cash / 现金 (93%)", "Person / 人物 (90%)", "Counter / 柜台 (78%)", "Folder / 文件夹 (65%)"],
    alert: true,
    alert_message: "⚠️ 检测到内部员工现金交易",
    behavior_confidence: 0.86,
    object_confidence: 0.9,
    cash_keyframes: [
      {
        frame_index: 42,
        timestamp_ms: 5200,
        mime_type: "image/png",
        detections: [
          { label: "Cash Bundle", confidence: 0.93, box: [12, 10, 88, 72] },
        ],
      },
    ],
    employee_keyframes: [
      {
        frame_index: 40,
        timestamp_ms: 5000,
        mime_type: "image/png",
        match: { name: "张三", similarity: 0.66 },
        detections: [
          { label: "Person", confidence: 0.88, box: [22, 18, 84, 96], match: { name: "张三", similarity: 0.66 } },
        ],
      },
    ],
    frame_sampling: {
      fps: 25,
      total_frames: 480,
      duration_seconds: 19.2,
      processed_frames: 12,
      sample_interval_frames: 12,
      generated_at: new Date().toISOString(),
    },
  }
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
  const language: Language = "zh"
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResponse | null>(null)
  const [rawJson, setRawJson] = useState("")
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    setLogs((prev) => {
      if (prev.length > 0) {
        return prev
      }

      const initialEntries: LogEntryPayload[] = [
        { kind: "system", key: "boot" },
        { kind: "system", key: "cashModule" },
        { kind: "system", key: "faceModule" },
        { kind: "system", key: "behaviorModule" },
        { kind: "system", key: "objectModule" },
      ]

      return initialEntries.map((entry) => createLogEntry(entry))
    })

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const ui = translations[language]

  const shouldAlert = useMemo(() => {
    if (!results) return false
    return results.cash_transaction && results.internal_employee
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

      if (data.cash_transaction && data.internal_employee) {
        const message = data.alert_message ?? ui.alert.bannerTitle
        setLogs((prev) => [...prev, createLogEntry({ kind: "alert", message })])
      }
    } catch (error) {
      const mock = createFallbackAnalysis()
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

      if (mock.cash_transaction && mock.internal_employee) {
        const messageToUse = mock.alert_message ?? ui.alert.bannerTitle
        setLogs((prev) => [...prev, createLogEntry({ kind: "alert", message: messageToUse })])
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col">
          <header className="mb-6">
            <div
              className={`rounded-xl bg-card/40 p-4 shadow-sm transition-all ${shouldAlert ? "animate-alert-surface border border-destructive/40" : "border border-border"}`}
            >
              <h1
                className={`mb-2 text-3xl font-bold tracking-tight sm:text-4xl ${shouldAlert ? "text-destructive" : "text-foreground"}`}
              >
                {ui.title}
              </h1>
              <p className={`text-base sm:text-lg ${shouldAlert ? "text-destructive/80" : "text-muted-foreground"}`}>{ui.subtitle}</p>
            </div>
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

        <div className="mb-6">
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
          <div className="mb-6">
            <h2 className="mb-3 text-xl font-semibold text-foreground">{ui.results.heading}</h2>
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
          formatLogEntry={(entry) => formatLogEntry(entry, language)}
          frameSampling={results?.frame_sampling ?? null}
          samplingHeading={ui.systemLog.samplingLabel}
          samplingEmptyLabel={ui.systemLog.samplingEmpty}
          samplingItems={ui.systemLog.samplingItems}
        />
        </div>

        <footer className="mt-8 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          © 2025 · 柜台现金交易监控告警系统
        </footer>
      </main>
    </div>
  )
}
