export type VideoAnnotationDetection = {
  id: string
  label: string
  confidence: number
  box: number[]
  matchName?: string | null
  isCash?: boolean
}

export type VideoAnnotationFrame = {
  timestampMs: number
  source: "cash" | "face"
  detections: VideoAnnotationDetection[]
}
