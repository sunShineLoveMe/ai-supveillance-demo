"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoData } from "@/app/page"

interface ResultsDisplayProps {
  video: VideoData
}

export function ResultsDisplay({ video }: ResultsDisplayProps) {
  if (!video.analyzed) {
    return (
      <Card className="border-border bg-card p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{video.label}</p>
          <p className="mt-2 text-xs">等待分析...</p>
        </div>
      </Card>
    )
  }

  const getStatusConfig = () => {
    switch (video.status) {
      case "normal":
        return {
          bg: "bg-success/10",
          border: "border-success/50",
          icon: <CheckCircle2 className="h-5 w-5 text-success" />,
          label: "✅ 正常办理",
          textColor: "text-success",
        }
      case "external-cash":
        return {
          bg: "bg-warning/10",
          border: "border-warning/50",
          icon: <AlertTriangle className="h-5 w-5 text-warning" />,
          label: "⚠️ 外部客户现金交易",
          textColor: "text-warning",
        }
      case "internal-cash":
        return {
          bg: "bg-destructive/10",
          border: "border-destructive/50",
          icon: <AlertTriangle className="h-5 w-5 animate-pulse-glow text-destructive" />,
          label: "⚠️ 内部员工现金交易（告警）",
          textColor: "text-destructive",
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <Card className={cn("border-2 p-6 transition-all", statusConfig.bg, statusConfig.border)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-card-foreground">{video.label}</h3>
        {statusConfig.icon}
      </div>

      {/* Cash Transaction Probability */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">现金交易概率</span>
          <span className="font-mono font-semibold text-foreground">{(video.cashProbability * 100).toFixed(1)}%</span>
        </div>
        <Progress value={video.cashProbability * 100} className="h-2" />
      </div>

      {/* Employee Match */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">内部员工匹配度</span>
          <span className="font-mono font-semibold text-foreground">{(video.faceSimilarity * 100).toFixed(1)}%</span>
        </div>
        <Progress value={video.faceSimilarity * 100} className="h-2" />
      </div>

      {/* Status Label */}
      <div
        className={cn(
          "rounded-md border px-3 py-2 text-center text-sm font-semibold",
          statusConfig.border,
          statusConfig.textColor,
        )}
      >
        {statusConfig.label}
      </div>
    </Card>
  )
}
