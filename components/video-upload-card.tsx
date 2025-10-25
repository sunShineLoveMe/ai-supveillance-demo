"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, Video, Loader2 } from "lucide-react"
import type { VideoData } from "@/app/page"

interface VideoUploadCardProps {
  video: VideoData
  onFileUpload: (id: string, file: File) => void
  onAnalyze: (id: string) => void
}

export function VideoUploadCard({ video, onFileUpload, onAnalyze }: VideoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      onFileUpload(video.id, file)
    }
  }

  return (
    <Card className="overflow-hidden border-border bg-card p-4 transition-all hover:border-primary/50">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-card-foreground">{video.label}</h3>
      </div>

      {/* Video Preview */}
      <div className="mb-3 aspect-video overflow-hidden rounded-md bg-secondary">
        {video.videoUrl ? (
          <video src={video.videoUrl} className="h-full w-full object-cover" controls />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Video className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Upload Button */}
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
      <Button
        variant="outline"
        size="sm"
        className="mb-2 w-full bg-transparent"
        onClick={() => fileInputRef.current?.click()}
        disabled={video.analyzing}
      >
        <Upload className="mr-2 h-4 w-4" />
        上传视频
      </Button>

      {/* Analyze Button */}
      <Button
        size="sm"
        className="w-full"
        onClick={() => onAnalyze(video.id)}
        disabled={!video.file || video.analyzing}
      >
        {video.analyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            分析中...
          </>
        ) : (
          "开始分析"
        )}
      </Button>
    </Card>
  )
}
