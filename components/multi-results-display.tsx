"use client"

import { ResultCard, type ResultCardStatusVariant } from "@/components/result-card"
import { Progress } from "@/components/ui/progress"
import { DollarSign, User, Activity, Package } from "lucide-react"
import { cn } from "@/lib/utils"

import type { AnalysisResponse } from "@/app/page"

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
    detectionsLabel: string
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

interface MultiResultsDisplayProps {
  results: AnalysisResponse
  copy: ResultsCopy
  shouldAlert: boolean
}

function formatTimestamp(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function MultiResultsDisplay({ results, copy, shouldAlert }: MultiResultsDisplayProps) {
  const keyframes = results.cash_keyframes ?? []
  const cashStatusVariant: ResultCardStatusVariant = results.cash_transaction
    ? shouldAlert
      ? "danger"
      : "warning"
    : "success"
  const cashStatusLabel = results.cash_transaction
    ? shouldAlert
      ? copy.cash.statuses.highRisk
      : copy.cash.statuses.detected
    : copy.cash.statuses.clear

  const behaviorConfidence = typeof results.behavior_confidence === "number"
    ? results.behavior_confidence
    : results.actions.length > 0
    ? 0.72
    : 0.35

  const objectConfidence = typeof results.object_confidence === "number"
    ? results.object_confidence
    : results.objects.length > 0
    ? 0.68
    : 0.3

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ResultCard
        icon={DollarSign}
        title={copy.cash.title}
        status={{ label: cashStatusLabel, variant: cashStatusVariant }}
        animate={shouldAlert && results.cash_transaction}
      >
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{copy.cash.progressLabel}</span>
            <span className="font-mono text-sm text-foreground">{(results.cash_confidence * 100).toFixed(1)}%</span>
          </div>
          <Progress value={results.cash_confidence * 100} className="h-2" />
        </div>
        <p className="text-sm text-muted-foreground">
          {results.cash_transaction ? copy.cash.details.detected : copy.cash.details.clear}
        </p>
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{copy.cash.keyframesTitle}</h4>
          {keyframes.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {keyframes.map((frame) => {
                const detectionSummary = frame.detections.length
                  ? frame.detections.map((det) => `${det.label} ${(det.confidence * 100).toFixed(0)}%`).join(" / ")
                  : "—"
                return (
                  <figure
                    key={`${frame.frame_index}-${frame.timestamp_ms}`}
                    className="overflow-hidden rounded-lg border border-border/40 bg-background/60 shadow-sm"
                  >
                    <img
                      src={`data:${frame.mime_type ?? "image/jpeg"};base64,${frame.image_base64}`}
                      alt={`Cash detection frame ${frame.frame_index}`}
                      className="h-auto w-full object-cover"
                    />
                    <figcaption className="space-y-1 border-t border-border/40 p-3 text-xs">
                      <div className="font-medium text-foreground">
                        {formatTimestamp(frame.timestamp_ms)} · #{frame.frame_index}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{copy.cash.detectionsLabel}:</span> {detectionSummary}
                      </div>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.cash.keyframesEmpty}</p>
          )}
        </div>
      </ResultCard>

      <ResultCard
        icon={User}
        title={copy.face.title}
        status={{
          label: results.internal_employee ? copy.face.statuses.employee : copy.face.statuses.visitor,
          variant: results.internal_employee ? (shouldAlert ? "danger" : "info") : "neutral",
        }}
        animate={shouldAlert && results.internal_employee}
      >
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{copy.face.progressLabel}</span>
            <span className="font-mono text-sm text-foreground">{(results.face_similarity * 100).toFixed(1)}%</span>
          </div>
          <Progress value={results.face_similarity * 100} className="h-2" />
        </div>
        <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm font-medium text-foreground">
          {copy.face.identityLabel(results.employee_name)}
        </div>
      </ResultCard>

      <ResultCard
        icon={Activity}
        title={copy.behavior.title}
        status={{
          label: copy.behavior.badgeLabel(results.actions.length),
          variant: (results.actions.length ? "info" : "neutral") as ResultCardStatusVariant,
        }}
        animate={shouldAlert && results.actions.length > 0}
      >
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{copy.behavior.confidenceLabel}</span>
            <span className="font-mono text-sm text-foreground">{(behaviorConfidence * 100).toFixed(1)}%</span>
          </div>
          <Progress value={behaviorConfidence * 100} className="h-2" />
        </div>
        <div className="space-y-2">
          {results.actions.length ? (
            results.actions.map((action, index) => (
              <div key={`${action}-${index}`} className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm">
                • {action}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              {copy.behavior.empty}
            </div>
          )}
        </div>
      </ResultCard>

      <ResultCard
        icon={Package}
        title={copy.objects.title}
        status={{
          label: copy.objects.badgeLabel(results.objects.length),
          variant: (results.objects.length ? "info" : "neutral") as ResultCardStatusVariant,
        }}
        animate={shouldAlert && results.objects.length > 0}
      >
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{copy.objects.confidenceLabel}</span>
            <span className="font-mono text-sm text-foreground">{(objectConfidence * 100).toFixed(1)}%</span>
          </div>
          <Progress value={objectConfidence * 100} className="h-2" />
        </div>
        {results.objects.length ? (
          <div className="flex flex-wrap gap-2">
            {results.objects.map((obj, index) => (
              <span key={`${obj}-${index}`} className={cn("rounded-full px-3 py-1 text-xs font-semibold", shouldAlert ? "bg-destructive/10 text-destructive" : "bg-primary/20 text-primary")}>{obj}</span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {copy.objects.empty}
          </div>
        )}
      </ResultCard>
    </div>
  )
}
