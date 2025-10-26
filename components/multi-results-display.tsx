"use client"

import { useState } from "react"

import { ResultCard, type ResultCardStatusVariant } from "@/components/result-card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DollarSign, User, Activity, Package } from "lucide-react"
import { cn } from "@/lib/utils"

import type { AnalysisResponse, CashKeyframe } from "@/app/page"

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
  const [frameViewerOpen, setFrameViewerOpen] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<CashKeyframe | null>(null)

  const handleOpenFrame = (frame: CashKeyframe) => {
    setSelectedFrame(frame)
    setFrameViewerOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setFrameViewerOpen(open)
    if (!open) {
      setSelectedFrame(null)
    }
  }
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
                    className="group overflow-hidden rounded-lg border border-border/40 bg-background/60 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenFrame(frame)}
                      className="relative block w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary"
                      aria-label={`${copy.cash.viewLargerLabel} · ${formatTimestamp(frame.timestamp_ms)} #${frame.frame_index}`}
                    >
                      <img
                        src={`data:${frame.mime_type ?? "image/jpeg"};base64,${frame.image_base64}`}
                        alt={`Cash detection frame ${frame.frame_index}`}
                        className="h-auto w-full object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {copy.cash.viewLargerLabel}
                      </span>
                    </button>
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
            {results.objects.map((obj, index) => {
              const isCashTag = /现金|cash/i.test(obj)
              return (
                <span
                  key={`${obj}-${index}`}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    isCashTag
                      ? "border border-yellow-400/70 bg-yellow-500/20 text-yellow-700 shadow-sm"
                      : shouldAlert
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/20 text-primary",
                  )}
                >
                  {obj}
                </span>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {copy.objects.empty}
          </div>
        )}
      </ResultCard>
      <Dialog open={frameViewerOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-4xl">
          {selectedFrame && (
            <>
              <DialogHeader className="space-y-1">
                <DialogTitle>{copy.cash.dialogTitle}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>
                    {copy.cash.dialogTimestampLabel}: {formatTimestamp(selectedFrame.timestamp_ms)}
                  </span>
                  <span>
                    {copy.cash.dialogFrameLabel}: #{selectedFrame.frame_index}
                  </span>
                  <span>
                    {copy.cash.detectionsLabel}: {selectedFrame.detections.length}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-lg border border-border/50 bg-black/80">
                  <img
                    src={`data:${selectedFrame.mime_type ?? "image/jpeg"};base64,${selectedFrame.image_base64}`}
                    alt={`Cash detection frame ${selectedFrame.frame_index}`}
                    className="mx-auto max-h-[70vh] w-full object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-foreground">{copy.cash.detectionsLabel}</h5>
                  <ul className="grid gap-2 text-sm">
                    {selectedFrame.detections.map((det, index) => (
                      <li
                        key={`${det.label}-${index}-${det.box.join("-")}`}
                        className="rounded-md border border-border/40 bg-background/70 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{det.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {(det.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          box: [{det.box.join(", ")}]
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
