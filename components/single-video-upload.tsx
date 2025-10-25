"use client"

import type React from "react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, Loader2, Play, FileVideo } from "lucide-react"

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
}

export function SingleVideoUpload({ videoUrl, analyzing, onFileUpload, onAnalyze, hasVideo, copy }: SingleVideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
    <Card className="overflow-hidden border-2 border-primary/30 bg-card/60 p-6">
      <div className="mb-6 flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold text-foreground">{copy.sectionTitle}</h2>
        <p className="text-sm text-muted-foreground">{copy.sectionDescription}</p>
      </div>

      <div
        className={`mb-6 flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          isDragging ? "border-primary bg-primary/10" : "border-border/60 bg-secondary/40"
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="presentation"
      >
        {videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" controls playsInline />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <FileVideo className="h-12 w-12" />
            <div className="text-sm font-medium">{copy.emptyPlaceholder}</div>
            <p className="text-xs opacity-80">{copy.dropHint}</p>
          </div>
        )}
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
