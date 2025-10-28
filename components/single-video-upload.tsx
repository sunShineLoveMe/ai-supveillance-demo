"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, Loader2, Play, FileVideo } from "lucide-react"
import type { VideoAnnotationFrame } from "@/lib/video-annotations"

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

interface SingleVideoUploadProps {
  videoUrl: string | null
  analyzing: boolean
  onFileUpload: (file: File) => void
  onAnalyze: () => void
  hasVideo: boolean
  copy: UploadCopy
  annotations?: VideoAnnotationFrame[]
}

export function SingleVideoUpload({
  videoUrl,
  analyzing,
  onFileUpload,
  onAnalyze,
  hasVideo,
  copy,
  annotations,
}: SingleVideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeFrame, setActiveFrame] = useState<VideoAnnotationFrame | null>(null)

  const sortedAnnotations = useMemo(() => {
    if (!annotations?.length) {
      return []
    }

    return [...annotations].sort((a, b) => a.timestampMs - b.timestampMs)
  }, [annotations])

  useEffect(() => {
    if (!sortedAnnotations.length) {
      setActiveFrame(null)
      return
    }

    const video = videoRef.current
    if (!video) {
      return
    }

    const selectClosestFrame = () => {
      if (!sortedAnnotations.length) {
        setActiveFrame(null)
        return
      }

      const currentTimeMs = video.currentTime * 1000
      let bestFrame: VideoAnnotationFrame | null = null
      let smallestDiff = Number.POSITIVE_INFINITY

      for (const frame of sortedAnnotations) {
        const diff = Math.abs(frame.timestampMs - currentTimeMs)
        if (diff < smallestDiff) {
          smallestDiff = diff
          bestFrame = frame
        }
      }

      const toleranceMs = 600
      if (bestFrame && smallestDiff <= toleranceMs) {
        setActiveFrame(bestFrame)
      } else {
        setActiveFrame(null)
      }
    }

    const clearFrame = () => setActiveFrame(null)

    selectClosestFrame()
    video.addEventListener("timeupdate", selectClosestFrame)
    video.addEventListener("seeked", selectClosestFrame)
    video.addEventListener("play", selectClosestFrame)
    video.addEventListener("pause", selectClosestFrame)
    video.addEventListener("ended", clearFrame)

    return () => {
      video.removeEventListener("timeupdate", selectClosestFrame)
      video.removeEventListener("seeked", selectClosestFrame)
      video.removeEventListener("play", selectClosestFrame)
      video.removeEventListener("pause", selectClosestFrame)
      video.removeEventListener("ended", clearFrame)
    }
  }, [sortedAnnotations])

  const formatTimestamp = (timestampMs: number) => {
    const totalSeconds = Math.floor(Math.max(0, timestampMs) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const convertBoxToStyle = (box: number[]) => {
    const normalize = (value: number) => {
      if (Number.isNaN(value)) return 0
      const ratio = value <= 1 ? value * 100 : value
      return Math.min(100, Math.max(0, ratio))
    }

    const left = normalize(box[0] ?? 0)
    const top = normalize(box[1] ?? 0)
    const right = normalize(box[2] ?? left)
    const bottom = normalize(box[3] ?? top)
    const width = Math.max(1, right - left)
    const height = Math.max(1, bottom - top)

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    }
  }

  const activeDetections = activeFrame?.detections ?? []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      onFileUpload(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file && file.type.startsWith("video/")) {
      onFileUpload(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  return (
    <Card className="overflow-hidden border-2 border-primary/30 bg-card/60 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold text-foreground">{copy.sectionTitle}</h2>
        <p className="text-sm text-muted-foreground">{copy.sectionDescription}</p>
      </div>

      <div className="mb-5 flex w-full justify-center">
        <div
          className={`flex aspect-square w-full max-w-[420px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all sm:max-w-[480px] lg:max-w-[560px] ${
            isDragging ? "border-primary bg-primary/10" : "border-border/60 bg-secondary/40"
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="presentation"
        >
          {videoUrl ? (
            <div className="relative h-full w-full">
              <video ref={videoRef} src={videoUrl} className="h-full w-full object-contain" controls playsInline />
              {sortedAnnotations.length > 0 && (
                <div className="pointer-events-none absolute inset-0">
                  {activeDetections.map((detection) => {
                    const confidence = Math.round(detection.confidence * 100)
                    const label = detection.matchName
                      ? `${detection.matchName} · ${confidence}%`
                      : `${detection.label} · ${confidence}%`
                    const isCashDetection = detection.isCash ?? activeFrame?.source === "cash"
                    const borderColor = isCashDetection ? "border-red-500" : "border-emerald-500"
                    const badgeColor = isCashDetection ? "bg-red-500" : "bg-emerald-500"
                    const badgeTextColor = "text-white"
                    return (
                      <div
                        key={detection.id}
                        className={`absolute rounded-lg border-2 ${borderColor} bg-black/15 backdrop-blur-[1px]`}
                        style={convertBoxToStyle(detection.box)}
                      >
                        <div
                          className={`absolute left-0 top-0 z-[1] rounded-br-lg rounded-tl-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeColor} ${badgeTextColor}`}
                        >
                          {label}
                        </div>
                      </div>
                    )
                  })}

                  {activeFrame ? (
                    <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-sm">
                      {formatTimestamp(activeFrame.timestampMs)}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <FileVideo className="h-12 w-12" />
              <div className="text-sm font-medium">{copy.emptyPlaceholder}</div>
              <p className="text-xs opacity-80">{copy.dropHint}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="lg"
          className="flex-1 border-primary/40 bg-background/80"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          <Upload className="mr-2 h-5 w-5" />
          {hasVideo ? copy.reuploadButton : copy.uploadButton}
        </Button>

        <Button
          size="lg"
          className="flex-1 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          onClick={onAnalyze}
          disabled={!hasVideo || analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {copy.analyzingLabel}
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              {copy.analyzeButton}
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
