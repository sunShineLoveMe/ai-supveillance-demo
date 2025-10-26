import { NextResponse } from "next/server"

const ANALYZE_BACKEND_ENDPOINT =
  process.env.ANALYZE_API_URL || process.env.AI_BACKEND_URL || process.env.NEXT_PUBLIC_ANALYZE_API_URL

const DEFAULT_ANALYZE_BACKEND_ENDPOINT = "http://127.0.0.1:8000/analyze"

const normalizeEndpoint = (endpoint: string): string => {
  if (!endpoint) return endpoint

  try {
    const parsed = new URL(endpoint)
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/analyze"
      return parsed.toString()
    }
    if (parsed.pathname.endsWith("/")) {
      const trimmedPath = parsed.pathname.replace(/\/+$/, "")
      parsed.pathname = trimmedPath.endsWith("/analyze") ? trimmedPath : `${trimmedPath}/analyze`
      return parsed.toString()
    }
    return endpoint
  } catch {
    const trimmed = endpoint.replace(/\/+$/, "")
    return trimmed.endsWith("/analyze") ? trimmed : `${trimmed}/analyze`
  }
}

const resolveAnalyzeEndpoint = (): string | undefined => {
  const trimmed = ANALYZE_BACKEND_ENDPOINT?.trim()
  if (trimmed) {
    return normalizeEndpoint(trimmed)
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_ANALYZE_BACKEND_ENDPOINT
  }

  return undefined
}

const createFallbackPayload = () => ({
  cash_transaction: true,
  cash_confidence: 0.93,
  internal_employee: true,
  face_similarity: 0.88,
  employee_name: "张三",
  employee_match_score: 0.66,
  actions: ["频繁手部运动", "递交文件", "注视现金区域"],
  objects: ["Cash / 现金 (93%)", "Person / 人物 (90%)", "Counter / 柜台 (78%)", "Folder / 文件夹 (65%)"],
  alert: true,
  alert_message: "⚠️ 检测到内部员工现金交易",
  behavior_confidence: 0.86,
  object_confidence: 0.9,
  cash_keyframes: [
    {
      frame_index: 42,
      timestamp_ms: 5200,
      mime_type: "image/png",
      detections: [
        {
          label: "Cash Bundle",
          confidence: 0.93,
          box: [12, 10, 88, 72],
        },
      ],
    },
  ],
  employee_keyframes: [
    {
      frame_index: 40,
      timestamp_ms: 5000,
      mime_type: "image/png",
      match: { name: "张三", similarity: 0.66 },
      detections: [
        {
          label: "Person",
          confidence: 0.88,
          box: [22, 18, 84, 96],
          match: { name: "张三", similarity: 0.66 },
        },
      ],
    },
  ],
  frame_sampling: {
    fps: 25,
    total_frames: 480,
    duration_seconds: 19.2,
    processed_frames: 12,
    sample_interval_frames: 12,
    generated_at: new Date().toISOString(),
  },
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing video file" }, { status: 400 })
    }

    const endpoint = resolveAnalyzeEndpoint()
    if (!endpoint) {
      console.warn("ANALYZE_API_URL is not configured; falling back to mock data")
      return NextResponse.json(createFallbackPayload())
    }

    const forwardFormData = new FormData()
    const blob = file as Blob & { name?: string }
    forwardFormData.append("file", blob, blob.name ?? "upload.mp4")

    const response = await fetch(endpoint, {
      method: "POST",
      body: forwardFormData,
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      console.error("AI analyze backend responded with", response.status, response.statusText)
      return NextResponse.json(createFallbackPayload(), { status: 200 })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("AI analyze proxy failed", error)
    return NextResponse.json(createFallbackPayload(), { status: 200 })
  }
}
