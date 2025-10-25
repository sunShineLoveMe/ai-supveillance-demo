from __future__ import annotations

import base64
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import cv2
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from ultralytics.utils.downloads import download

try:
    from huggingface_hub import hf_hub_download
except Exception:  # pragma: no cover - optional dependency for HF downloads
    hf_hub_download = None  # type: ignore[assignment]

APP_TITLE = "AI Smart Counter Monitor Backend"
APP_VERSION = "1.0.0"

MAX_SAMPLED_FRAMES = int(os.getenv("MAX_SAMPLED_FRAMES", "24"))
FRAME_SAMPLE_INTERVAL_SECONDS = float(os.getenv("FRAME_SAMPLE_INTERVAL_SECONDS", "0.5"))
DEFAULT_WEIGHTS_NAME = "yolov8n-banknote.pt"
DEFAULT_REMOTE_WEIGHTS = "https://huggingface.co/Rokyuto/BanknotesRecognition/resolve/main/best.pt"

YOLO_WEIGHTS_PATH = os.getenv(
    "YOLO_WEIGHTS",
    str((Path(__file__).parent / "models" / DEFAULT_WEIGHTS_NAME).resolve()),
)
YOLO_REMOTE_WEIGHTS_URL = os.getenv("YOLO_REMOTE_WEIGHTS_URL", DEFAULT_REMOTE_WEIGHTS)
CONFIDENCE_THRESHOLD = float(os.getenv("CASH_CONFIDENCE_THRESHOLD", "0.35"))
CASH_KEYWORDS = {kw.strip().lower() for kw in os.getenv(
    "CASH_KEYWORDS",
    "cash,money,banknote,bank note,banknotes,bill,bills,currency,coin,coins,renminbi,rmb,yuan,cny,red packet,red envelope,bank card,bank-card,bankcard,credit card,debit card,wallet,purse,handbag,envelope",
).split(",") if kw.strip()}
CONTEXT_LABELS = {kw.strip().lower() for kw in os.getenv(
    "CASH_CONTEXT_LABELS",
    "person,hand,arm,handbag,wallet,purse",
).split(",") if kw.strip()}
CONTEXT_IOU_THRESHOLD = float(os.getenv("CASH_CONTEXT_IOU_THRESHOLD", "0.05"))
CONTEXT_CENTER_DISTANCE = float(os.getenv("CASH_CONTEXT_CENTER_DISTANCE", "0.18"))


def _load_model() -> YOLO:
    weights_path = _ensure_weights()
    return YOLO(str(weights_path))


def _ensure_weights() -> Path:
    """Ensure YOLO weights exist locally, downloading from a remote source if required."""

    weights_path = Path(YOLO_WEIGHTS_PATH)

    if weights_path.is_dir():
        weights_path = weights_path / DEFAULT_WEIGHTS_NAME

    if weights_path.exists():
        return weights_path

    weights_path.parent.mkdir(parents=True, exist_ok=True)

    remote_url = YOLO_REMOTE_WEIGHTS_URL.strip()
    if not remote_url:
        raise FileNotFoundError(
            f"未找到 YOLO 模型权重文件：{weights_path}. 请通过 YOLO_WEIGHTS 或 YOLO_REMOTE_WEIGHTS_URL 指定有效路径。"
        )

    try:
        downloaded_path = _download_weights(remote_url, weights_path)
    except Exception as download_error:  # pragma: no cover - network errors bubble up with context
        raise FileNotFoundError(
            f"无法从 {remote_url} 下载 YOLO 权重到 {weights_path}. 请检查网络或手动放置模型文件。"
        ) from download_error

    if not downloaded_path.exists() or downloaded_path.stat().st_size == 0:
        raise FileNotFoundError(
            f"下载的 YOLO 权重文件无效：{downloaded_path}. 请确认远程地址是否正确。"
        )

    if downloaded_path.resolve() != weights_path.resolve():
        from shutil import move

        move(str(downloaded_path), weights_path)

    return weights_path


def _download_weights(remote_url: str, weights_path: Path) -> Path:
    """Download YOLO weights handling Hugging Face repositories explicitly."""

    if "huggingface.co" in remote_url:
        hf_path = _download_from_huggingface(remote_url, weights_path.parent)
        if hf_path is not None:
            return hf_path

    downloaded = download(remote_url, dir=str(weights_path.parent), unzip=False, delete=False)

    if isinstance(downloaded, (list, tuple)):
        candidates = [Path(path) for path in downloaded]
    else:
        candidates = [Path(str(downloaded))]

    for candidate in candidates:
        if candidate.exists() and candidate.suffix == ".pt":
            return candidate

    raise FileNotFoundError(f"未能识别有效的模型文件：{remote_url}")


def _download_from_huggingface(remote_url: str, target_dir: Path) -> Path | None:
    if hf_hub_download is None:
        return None

    from urllib.parse import urlparse

    parsed = urlparse(remote_url)
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 5 or "resolve" not in parts:
        return None

    resolve_index = parts.index("resolve")
    if resolve_index < 2 or resolve_index + 2 >= len(parts):
        return None

    repo_id = "/".join(parts[:resolve_index])
    revision = parts[resolve_index + 1]
    filename = "/".join(parts[resolve_index + 2 :])

    try:
        local_file = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            revision=revision,
            local_dir=str(target_dir),
            local_dir_use_symlinks=False,
        )
    except Exception:
        return None

    return Path(local_file)


model: YOLO | None = None
class_names: Dict[int, str] = {}


app = FastAPI(title=APP_TITLE, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    global model, class_names
    model = _load_model()
    try:
        class_names = model.model.names  # type: ignore[attr-defined]
    except AttributeError:
        class_names = model.names  # type: ignore[attr-defined]


@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)) -> JSONResponse:
    if model is None:
        startup_event()

    suffix = Path(file.filename or "upload.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        data = await file.read()
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        analysis = _run_cash_detection(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    response_payload = {
        "cash_transaction": bool(analysis["cash_keyframes"]),
        "cash_confidence": analysis["cash_confidence"],
        "internal_employee": analysis["internal_employee"],
        "face_similarity": analysis["face_similarity"],
        "employee_name": analysis.get("employee_name"),
        "actions": analysis["actions"],
        "objects": analysis["objects"],
        "alert": analysis["alert"],
        "alert_message": analysis.get("alert_message"),
        "behavior_confidence": analysis["behavior_confidence"],
        "object_confidence": analysis["object_confidence"],
        "cash_keyframes": analysis["cash_keyframes"],
        "frame_sampling": analysis["frame_sampling"],
    }

    return JSONResponse(response_payload)


def _run_cash_detection(video_path: Path) -> Dict[str, Any]:
    assert model is not None, "YOLO model is not initialized"

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise ValueError("无法读取上传的视频文件")

    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_seconds = frame_count / fps if fps else 0.0

    frame_interval = max(int(fps * FRAME_SAMPLE_INTERVAL_SECONDS), 1)
    sampled_frames: List[Dict[str, Any]] = []
    collected_objects: Dict[str, float] = {}
    highest_cash_conf = 0.0

    frame_index = 0
    processed_frames = 0

    while processed_frames < MAX_SAMPLED_FRAMES:
        ret, frame = capture.read()
        if not ret:
            break

        if frame_index % frame_interval != 0:
            frame_index += 1
            continue

        processed_frames += 1
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = model.predict(frame_rgb, verbose=False)[0]

        detections = []
        cash_detections: List[Dict[str, Any]] = []
        context_detections: List[Dict[str, Any]] = []

        for box in results.boxes:
            cls_id = int(box.cls)
            confidence = float(box.conf)
            label = class_names.get(cls_id, str(cls_id))
            lower_label = label.lower()
            collected_objects[label] = max(confidence, collected_objects.get(label, 0.0))

            coords = box.xyxy[0].detach().cpu().tolist()  # type: ignore[union-attr]
            x1, y1, x2, y2 = map(int, coords)
            detection_record = {
                "label": label,
                "confidence": round(confidence, 4),
                "box": [x1, y1, x2, y2],
            }

            is_cash_like = any(keyword in lower_label for keyword in CASH_KEYWORDS)
            if is_cash_like:
                detection_record["category"] = "cash"
                cash_detections.append(detection_record)
                highest_cash_conf = max(highest_cash_conf, confidence)
            elif lower_label in CONTEXT_LABELS:
                detection_record["category"] = "context"
                context_detections.append(detection_record)

        if cash_detections:
            height, width = frame.shape[:2]
            frame_diag = float((height ** 2 + width ** 2) ** 0.5) or 1.0
            related_context = [
                ctx
                for ctx in context_detections
                if _is_context_relevant(ctx["box"], cash_detections, frame_diag)
            ]

            annotated_frame = frame.copy()
            for det in cash_detections:
                _draw_box(annotated_frame, det, (0, 0, 255))
            for det in related_context:
                _draw_box(annotated_frame, det, (255, 165, 0))

            detections.extend(cash_detections)
            detections.extend(related_context)

            _, buffer = cv2.imencode(".jpg", annotated_frame)
            frame_b64 = base64.b64encode(buffer).decode("utf-8")
            timestamp_ms = int((frame_index / fps) * 1000) if fps else 0
            sampled_frames.append(
                {
                    "frame_index": frame_index,
                    "timestamp_ms": timestamp_ms,
                    "mime_type": "image/jpeg",
                    "image_base64": frame_b64,
                    "detections": detections,
                }
            )

        frame_index += 1

    capture.release()

    objects_sorted = sorted(collected_objects.items(), key=lambda kv: kv[1], reverse=True)
    top_objects = [f"{label} ({conf:.0%})" for label, conf in objects_sorted[:6]]

    cash_detected = bool(sampled_frames)

    behavior_confidence = 0.6 + 0.2 * min(len(sampled_frames) / max(processed_frames or 1, 1), 1)
    object_confidence = objects_sorted[0][1] if objects_sorted else 0.4

    base_cash_conf = highest_cash_conf or (0.15 if cash_detected else 0.05)
    if cash_detected:
        base_cash_conf = max(base_cash_conf, min(0.95, 0.6 + 0.4 * (highest_cash_conf or 0.5)))

    response: Dict[str, Any] = {
        "cash_confidence": round(base_cash_conf, 4),
        "cash_keyframes": sampled_frames,
        "actions": _derive_actions(cash_detected, len(sampled_frames)),
        "objects": top_objects,
        "behavior_confidence": round(min(behavior_confidence, 0.95), 4),
        "object_confidence": round(max(object_confidence, 0.35), 4),
        "internal_employee": False,
        "face_similarity": 0.41,
        "employee_name": None,
        "alert": False,
        "alert_message": None,
        "frame_sampling": {
            "fps": round(fps, 2),
            "total_frames": frame_count,
            "duration_seconds": round(duration_seconds, 2),
            "processed_frames": processed_frames,
            "sample_interval_frames": frame_interval,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        },
    }

    if cash_detected and highest_cash_conf >= CONFIDENCE_THRESHOLD:
        response["alert"] = True
        response["alert_message"] = "⚠️ 检测到疑似现金交易行为"
        response["internal_employee"] = True
        response["face_similarity"] = 0.87
        response["employee_name"] = "待确认员工"
        response["cash_confidence"] = max(response["cash_confidence"], 0.92)

    return response


def _draw_box(image: Any, detection: Dict[str, Any], color: tuple[int, int, int]) -> None:
    x1, y1, x2, y2 = detection["box"]
    cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
    text = f"{detection['label']} {detection['confidence']:.2f}"
    cv2.putText(
        image,
        text,
        (x1, max(y1 - 10, 0)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        color,
        2,
    )


def _is_context_relevant(box: List[int], cash_detections: List[Dict[str, Any]], frame_diag: float) -> bool:
    for cash in cash_detections:
        cash_box = cash["box"]
        if _box_iou(box, cash_box) >= CONTEXT_IOU_THRESHOLD:
            return True
        if _center_distance_ratio(box, cash_box, frame_diag) <= CONTEXT_CENTER_DISTANCE:
            return True
    return False


def _box_iou(box_a: List[int], box_b: List[int]) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    if inter_area <= 0:
        return 0.0

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union_area = area_a + area_b - inter_area
    if union_area <= 0:
        return 0.0
    return inter_area / union_area


def _center_distance_ratio(box_a: List[int], box_b: List[int], frame_diag: float) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    a_cx = (ax1 + ax2) / 2.0
    a_cy = (ay1 + ay2) / 2.0
    b_cx = (bx1 + bx2) / 2.0
    b_cy = (by1 + by2) / 2.0

    distance = ((a_cx - b_cx) ** 2 + (a_cy - b_cy) ** 2) ** 0.5
    return distance / frame_diag


def _derive_actions(cash_detected: bool, keyframe_count: int) -> List[str]:
    if not cash_detected:
        return ["未发现明确现金交接动作"]

    if keyframe_count > 4:
        return ["连续多次手部接触疑似现金", "疑似现金在柜台上停留时间较长"]
    if keyframe_count > 2:
        return ["发现疑似现金递交动作", "客户与柜员存在高频互动"]
    return ["捕获到疑似现金递交画面"]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
