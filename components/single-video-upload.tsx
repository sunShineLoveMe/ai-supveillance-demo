"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, Video, Loader2, Play } from "lucide-react"

interface SingleVideoUploadProps {
  videoUrl: string | null
  analyzing: boolean
  onFileUpload: (file: File) => void
  onAnalyze: () => void
  hasVideo: boolean
}

export function SingleVideoUpload({ videoUrl, analyzing, onFileUpload, onAnalyze, hasVideo }: SingleVideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      onFileUpload(file)
    }
  }

  return (
    <Card className="overflow-hidden border-2 border-primary/30 bg-card p-8">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-foreground">视频上传区域</h2>
        <p className="text-sm text-muted-foreground">上传视频后，系统将自动进行四种AI分析</p>
      </div>

      {/* Video Preview */}
      <div className="mb-6 aspect-video overflow-hidden rounded-lg bg-secondary">
        {videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" controls />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Video className="h-20 w-20 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无视频</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
        <Button
          variant="outline"
          size="lg"
          className="flex-1 bg-transparent"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          <Upload className="mr-2 h-5 w-5" />
          {hasVideo ? "重新上传视频" : "上传视频"}
        </Button>

        <Button size="lg" className="flex-1" onClick={onAnalyze} disabled={!hasVideo || analyzing}>
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              AI 分析中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              开始 AI 分析
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
