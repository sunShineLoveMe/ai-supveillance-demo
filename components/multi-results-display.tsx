"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DollarSign, User, Activity, Package, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnalysisResults } from "@/app/page"

interface MultiResultsDisplayProps {
  results: AnalysisResults
}

export function MultiResultsDisplay({ results }: MultiResultsDisplayProps) {
  const hasAlert = results.cashDetection.detected && results.faceRecognition.isEmployee

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Cash Detection */}
      <Card
        className={cn(
          "border-2 p-6 transition-all",
          results.cashDetection.detected ? "border-warning/50 bg-warning/10" : "border-success/50 bg-success/10",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", results.cashDetection.detected ? "bg-warning/20" : "bg-success/20")}>
              <DollarSign className={cn("h-6 w-6", results.cashDetection.detected ? "text-warning" : "text-success")} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">现金交易检测</h3>
          </div>
          {results.cashDetection.detected ? (
            <AlertTriangle className="h-5 w-5 text-warning" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-success" />
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">检测概率</span>
            <span className="font-mono font-semibold text-foreground">
              {(results.cashDetection.probability * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={results.cashDetection.probability * 100} className="h-2" />
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2 text-center text-sm font-semibold",
            results.cashDetection.detected ? "border-warning/50 text-warning" : "border-success/50 text-success",
          )}
        >
          {results.cashDetection.detected ? "⚠️ 检测到现金交易" : "✅ 未检测到现金"}
        </div>
      </Card>

      {/* Face Recognition */}
      <Card
        className={cn(
          "border-2 p-6 transition-all",
          results.faceRecognition.isEmployee
            ? hasAlert
              ? "border-destructive/50 bg-destructive/10"
              : "border-primary/50 bg-primary/10"
            : "border-muted/50 bg-muted/10",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-lg p-2",
                results.faceRecognition.isEmployee ? (hasAlert ? "bg-destructive/20" : "bg-primary/20") : "bg-muted/20",
              )}
            >
              <User
                className={cn(
                  "h-6 w-6",
                  results.faceRecognition.isEmployee
                    ? hasAlert
                      ? "text-destructive"
                      : "text-primary"
                    : "text-muted-foreground",
                )}
              />
            </div>
            <h3 className="text-lg font-semibold text-foreground">员工人脸识别</h3>
          </div>
          {results.faceRecognition.isEmployee ? (
            hasAlert ? (
              <AlertTriangle className="h-5 w-5 animate-pulse-glow text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            )
          ) : (
            <XCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">匹配度</span>
            <span className="font-mono font-semibold text-foreground">
              {(results.faceRecognition.similarity * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={results.faceRecognition.similarity * 100} className="h-2" />
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2 text-center text-sm font-semibold",
            results.faceRecognition.isEmployee
              ? hasAlert
                ? "border-destructive/50 text-destructive"
                : "border-primary/50 text-primary"
              : "border-muted/50 text-muted-foreground",
          )}
        >
          {results.faceRecognition.isEmployee ? `👤 内部员工: ${results.faceRecognition.employeeName}` : "👥 非员工"}
        </div>
      </Card>

      {/* Behavior Analysis */}
      <Card
        className={cn(
          "border-2 p-6 transition-all",
          results.behaviorAnalysis.suspicious ? "border-warning/50 bg-warning/10" : "border-success/50 bg-success/10",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn("rounded-lg p-2", results.behaviorAnalysis.suspicious ? "bg-warning/20" : "bg-success/20")}
            >
              <Activity
                className={cn("h-6 w-6", results.behaviorAnalysis.suspicious ? "text-warning" : "text-success")}
              />
            </div>
            <h3 className="text-lg font-semibold text-foreground">行为分析</h3>
          </div>
          {results.behaviorAnalysis.suspicious ? (
            <AlertTriangle className="h-5 w-5 text-warning" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-success" />
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">置信度</span>
            <span className="font-mono font-semibold text-foreground">
              {(results.behaviorAnalysis.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={results.behaviorAnalysis.confidence * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          {results.behaviorAnalysis.behaviors.map((behavior, index) => (
            <div key={index} className="rounded-md bg-background/50 px-3 py-2 text-sm text-foreground">
              • {behavior}
            </div>
          ))}
        </div>
      </Card>

      {/* Object Detection */}
      <Card className="border-2 border-primary/30 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/20 p-2">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">物体检测</h3>
          </div>
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>

        <div className="mb-4">
          <div className="mb-2 text-sm text-muted-foreground">检测到的物体</div>
          <div className="flex flex-wrap gap-2">
            {results.objectDetection.objects.map((obj, index) => (
              <span key={index} className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
                {obj}
              </span>
            ))}
          </div>
        </div>

        {results.objectDetection.cashCount > 0 && (
          <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-center text-sm font-semibold text-warning">
            💵 检测到 {results.objectDetection.cashCount} 处现金
          </div>
        )}
      </Card>
    </div>
  )
}
