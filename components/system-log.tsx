"use client"

import { useMemo, useState } from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

import type { FrameSamplingMeta, LogEntry } from "@/app/page"

interface SystemLogProps {
  logs: LogEntry[]
  rawJson: string
  heading: string
  rawJsonLabel: string
  timelineLabel: string
  emptyLabel: string
  formatLogEntry: (entry: LogEntry) => string
  frameSampling?: FrameSamplingMeta | null
  samplingHeading: string
  samplingEmptyLabel: string
  samplingItems: {
    fps: string
    totalFrames: string
    duration: string
    processed: string
    interval: string
    generatedAt: string
  }
}

export function SystemLog({
  logs,
  rawJson,
  heading,
  rawJsonLabel,
  timelineLabel,
  emptyLabel,
  formatLogEntry,
  frameSampling,
  samplingHeading,
  samplingEmptyLabel,
  samplingItems,
}: SystemLogProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [],
  )
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  )

  const orderedLogs = useMemo(() => [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [logs])
  const hasJson = rawJson.trim().length > 0
  const samplingData = frameSampling ?? null
  const frameUnit = "帧"
  const durationUnit = "秒"

  return (
    <Card className="border-border bg-card shadow-sm">
      <div className="flex cursor-pointer items-center justify-between p-4" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>

      <div className={cn("overflow-hidden transition-all", isExpanded ? "max-h-[520px]" : "max-h-0")}>
        <div className="border-t border-border bg-secondary/40 p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{rawJsonLabel}</h3>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-background/90 p-3 text-xs">
                {hasJson ? (
                  <pre className="whitespace-pre-wrap font-mono text-muted-foreground">{rawJson}</pre>
                ) : (
                  <p className="text-muted-foreground/70">{emptyLabel}</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{timelineLabel}</h3>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-background/90 p-3 text-xs">
                {orderedLogs.length ? (
                  <ul className="space-y-2">
                    {orderedLogs.map((entry) => (
                      <li key={entry.id} className="space-y-1 rounded-md bg-background/70 p-2">
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {dateFormatter.format(new Date(entry.timestamp))}
                        </p>
                        <p className="text-sm text-foreground">{formatLogEntry(entry)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground/70">{emptyLabel}</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{samplingHeading}</h3>
              <div className="rounded-lg border border-border/60 bg-background/90 p-3 text-xs">
                {samplingData ? (
                  <dl className="space-y-2">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.fps}</dt>
                      <dd className="font-mono text-foreground">{numberFormatter.format(samplingData.fps)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.totalFrames}</dt>
                      <dd className="font-mono text-foreground">{numberFormatter.format(samplingData.total_frames)} {frameUnit}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.duration}</dt>
                      <dd className="font-mono text-foreground">{numberFormatter.format(samplingData.duration_seconds)} {durationUnit}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.processed}</dt>
                      <dd className="font-mono text-foreground">{numberFormatter.format(samplingData.processed_frames)} {frameUnit}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.interval}</dt>
                      <dd className="font-mono text-foreground">{numberFormatter.format(samplingData.sample_interval_frames)} {frameUnit}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{samplingItems.generatedAt}</dt>
                      <dd className="font-mono text-foreground">
                        {dateFormatter.format(new Date(samplingData.generated_at))}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-muted-foreground/70">{samplingEmptyLabel}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Card>
  )
}
