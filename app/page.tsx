"use client"

import { useState } from "react"
import { SingleVideoUpload } from "@/components/single-video-upload"
import { MultiResultsDisplay } from "@/components/multi-results-display"
import { SystemLog } from "@/components/system-log"
import { AlertTriangle } from "lucide-react"

export type AnalysisResults = {
  cashDetection: {
    probability: number
    detected: boolean
  }
  faceRecognition: {
    similarity: number
    isEmployee: boolean
    employeeName?: string
  }
  behaviorAnalysis: {
    suspicious: boolean
    confidence: number
    behaviors: string[]
  }
  objectDetection: {
    objects: string[]
    cashCount: number
  }
}

export default function Page() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [results, setResults] = useState<AnalysisResults | null>(null)

  const [logs, setLogs] = useState<string[]>([
    "[系统] AI 智能柜台监控系统已启动",
    "[系统] 现金交易检测模块已加载",
    "[系统] 员工识别模块已加载",
    "[系统] 行为分析模块已加载",
    "[系统] 物体检测模块已加载",
  ])

  const handleFileUpload = (file: File) => {
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    setAnalyzed(false)
    setResults(null)
    addLog(`[上传] ${file.name} 上传成功`)
  }

  const handleAnalyze = async () => {
    if (!videoFile) return

    setAnalyzing(true)
    addLog(`[分析] 开始分析视频`)
    addLog(`[分析] 视频时长: ${Math.floor(Math.random() * 60 + 30)}秒`)
    addLog(`[分析] 视频帧数: ${Math.floor(Math.random() * 500 + 200)}`)

    // Simulate analysis delay
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const cashProb = Math.random()
    const faceProb = Math.random()
    const behaviorProb = Math.random()
    const hasCash = cashProb > 0.7
    const isEmployee = faceProb > 0.75

    const analysisResults: AnalysisResults = {
      cashDetection: {
        probability: cashProb,
        detected: hasCash,
      },
      faceRecognition: {
        similarity: faceProb,
        isEmployee: isEmployee,
        employeeName: isEmployee ? ["张三", "李四", "王五", "赵六"][Math.floor(Math.random() * 4)] : undefined,
      },
      behaviorAnalysis: {
        suspicious: behaviorProb > 0.6,
        confidence: behaviorProb,
        behaviors: [
          behaviorProb > 0.6 ? "频繁查看周围" : "正常办理业务",
          hasCash ? "手持现金" : "无现金交易",
          isEmployee ? "员工身份确认" : "客户身份",
        ],
      },
      objectDetection: {
        objects: ["人物", hasCash ? "现金" : "银行卡", "柜台", "文件"],
        cashCount: hasCash ? Math.floor(Math.random() * 5 + 1) : 0,
      },
    }

    addLog(`[结果] 现金检测: ${hasCash ? "检测到现金" : "未检测到现金"} (${(cashProb * 100).toFixed(1)}%)`)
    addLog(
      `[结果] 人脸识别: ${isEmployee ? `员工 - ${analysisResults.faceRecognition.employeeName}` : "非员工"} (${(faceProb * 100).toFixed(1)}%)`,
    )
    addLog(`[结果] 行为分析: ${analysisResults.behaviorAnalysis.suspicious ? "可疑行为" : "正常行为"}`)
    addLog(`[结果] 物体检测: 检测到 ${analysisResults.objectDetection.objects.length} 个物体`)

    if (hasCash && isEmployee) {
      addLog(`[告警] ⚠️ 检测到内部员工现金交易！`)
    }

    setResults(analysisResults)
    setAnalyzing(false)
    setAnalyzed(true)
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("zh-CN")
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  const hasAlert = results?.cashDetection.detected && results?.faceRecognition.isEmployee

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">AI 智能柜台监控 Demo 系统</h1>
          <p className="text-lg text-muted-foreground">上传视频，AI 自动分析四种结果</p>
        </div>

        {/* Alert Banner */}
        {hasAlert && (
          <div className="mb-6 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 animate-pulse-glow text-destructive" />
              <div>
                <p className="font-semibold text-destructive">⚠️ 告警：内部员工现金交易</p>
                <p className="text-sm text-destructive/80">
                  检测到内部员工 {results?.faceRecognition.employeeName} 进行现金交易，请立即核查
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <SingleVideoUpload
            videoUrl={videoUrl}
            analyzing={analyzing}
            onFileUpload={handleFileUpload}
            onAnalyze={handleAnalyze}
            hasVideo={!!videoFile}
          />
        </div>

        {analyzed && results && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">AI 分析结果（四种检测）</h2>
            <MultiResultsDisplay results={results} />
          </div>
        )}

        {/* System Log */}
        <SystemLog logs={logs} />

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          仅用于内部演示 · AI智能柜台监控Demo © 2025 Zhiyun Tech
        </div>
      </div>
    </div>
  )
}
