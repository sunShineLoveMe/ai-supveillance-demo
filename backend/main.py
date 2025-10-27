from __future__ import annotations

import base64
import json
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

APP_TITLE = "AI Smart Counter Monitor Backend"
APP_VERSION = "1.0.0"

MAX_SAMPLED_FRAMES = int(os.getenv("MAX_SAMPLED_FRAMES", "24"))
FRAME_SAMPLE_INTERVAL_SECONDS = float(os.getenv("FRAME_SAMPLE_INTERVAL_SECONDS", "0.5"))
YOLO_WEIGHTS_PATH = os.getenv("YOLO_WEIGHTS", "yolov8n.pt")
CASH_CONFIDENCE_ALERT_THRESHOLD = float(os.getenv("CASH_CONFIDENCE_THRESHOLD", "0.3"))
CASH_MODEL_PATH_ENV = os.getenv("LOCAL_CASH_MODEL_PATH") or os.getenv("CASH_MODEL_PATH")
CASH_MODEL_PATH = (
    Path(CASH_MODEL_PATH_ENV)
    if CASH_MODEL_PATH_ENV
    else Path(os.getenv("DEFAULT_CASH_MODEL_PATH", "cash_detector.pt"))
)
CASH_MODEL_CONFIDENCE = float(
    os.getenv("CASH_MODEL_CONFIDENCE")
    or os.getenv("ROBOFLOW_CONFIDENCE")
    or "0.25"
)
CASH_MODEL_IOU = float(os.getenv("CASH_MODEL_IOU") or os.getenv("ROBOFLOW_IOU") or "0.45")
CASH_ALLOWED_PREFIX = (
    os.getenv("CASH_ALLOWED_PREFIX")
    or os.getenv("ROBOFLOW_CASH_PREFIX", "")
).strip().lower()
CASH_ALLOWED_LABELS = [
    item.strip().lower()
    for item in os.getenv("CASH_ALLOWED_LABELS", "").split(",")
    if item.strip()
]

EMPLOYEE_GALLERY_DIR = Path(
    os.getenv("EMPLOYEE_GALLERY_DIR", Path(__file__).parent / "employee_gallery")
)
EMPLOYEE_REGISTRY_FILE = Path(
    os.getenv("EMPLOYEE_REGISTRY_FILE", EMPLOYEE_GALLERY_DIR / "registry.json")
)
EMPLOYEE_SIMILARITY_THRESHOLD = float(os.getenv("EMPLOYEE_SIMILARITY_THRESHOLD", "0.32"))
EMPLOYEE_MIN_KEYPOINTS = int(os.getenv("EMPLOYEE_MIN_KEYPOINTS", "10"))
EMPLOYEE_DISTANCE_THRESHOLD = float(os.getenv("EMPLOYEE_DISTANCE_THRESHOLD", "60"))
EMPLOYEE_MAX_FEATURES = int(os.getenv("EMPLOYEE_MAX_FEATURES", "512"))


logger = logging.getLogger("uvicorn.error")


def _load_yolo_model() -> YOLO:
    weights_path = Path(YOLO_WEIGHTS_PATH)
    if not weights_path.exists():
        # allow ultralytics to download default weights automatically
        return YOLO(YOLO_WEIGHTS_PATH)
    return YOLO(str(weights_path))


def _resolve_cash_model_path(raw_path: Path) -> Optional[Path]:
    """Resolve the configured cash model path with several fallbacks."""

    candidates = []

    if raw_path.is_absolute():
        candidates.append(raw_path)
    else:
        candidates.extend(
            [
                raw_path,
                Path(__file__).parent / raw_path,
                Path(__file__).parent.parent / raw_path,
            ]
        )

        model_name = raw_path.name
        candidates.extend(
            [
                Path(__file__).parent / "models" / model_name,
                Path(__file__).parent.parent / "models" / model_name,
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def _load_cash_model() -> YOLO:
    global CASH_MODEL_PATH

    weights_path = _resolve_cash_model_path(CASH_MODEL_PATH) or CASH_MODEL_PATH

    if not weights_path.exists():
        raise RuntimeError(
            "未找到本地现金检测模型权重文件，请设置 LOCAL_CASH_MODEL_PATH 或 DEFAULT_CASH_MODEL_PATH"
        )

    CASH_MODEL_PATH = weights_path
    return YOLO(str(weights_path))


yolo_model: Optional[YOLO] = None
yolo_class_names: Dict[int, str] = {}
cash_model: Optional[YOLO] = None
cash_class_names: Dict[int, str] = {}
cash_allowed_ids: List[int] = []

employee_profiles: List[Dict[str, Any]] = []
face_feature_extractor = cv2.ORB_create(nfeatures=EMPLOYEE_MAX_FEATURES)
face_matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)


app = FastAPI(title=APP_TITLE, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_employee_registry() -> List[Dict[str, str]]:
    if EMPLOYEE_REGISTRY_FILE.exists():
        try:
            with EMPLOYEE_REGISTRY_FILE.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, list):
                entries: List[Dict[str, str]] = []
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get("name") or "模拟员工")
                    image = item.get("image")
                    if not image:
                        continue
                    entries.append({"name": name, "image": str(image)})
                if entries:
                    return entries
        except Exception:  # pragma: no cover - defensive parsing guard
            logger.exception("无法解析员工人脸 registry.json，回退到目录扫描模式")

    if not EMPLOYEE_GALLERY_DIR.exists():
        return []

    entries: List[Dict[str, str]] = []
    for path in sorted(EMPLOYEE_GALLERY_DIR.glob("*.jpg")):
        entries.append({"name": path.stem, "image": path.name})
    for path in sorted(EMPLOYEE_GALLERY_DIR.glob("*.png")):
        entries.append({"name": path.stem, "image": path.name})
    return entries


def _load_employee_gallery() -> None:
    employee_profiles.clear()

    try:
        EMPLOYEE_GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:  # pragma: no cover - directory creation guard
        logger.warning("无法创建员工图库目录: %s", EMPLOYEE_GALLERY_DIR)

    entries = _read_employee_registry()
    if not entries:
        logger.warning("未找到任何模拟员工人脸数据，所有分析将按访客处理")
        return

    loaded_names: List[str] = []
    for entry in entries:
        image_path = entry.get("image")
        if not image_path:
            continue
        resolved_path = (
            Path(image_path)
            if Path(image_path).is_absolute()
            else EMPLOYEE_GALLERY_DIR / image_path
        )
        image = cv2.imread(str(resolved_path))
        if image is None:
            logger.warning("无法读取员工人脸样本: %s", resolved_path)
            continue
        keypoints, descriptors = _compute_face_features(image)
        if descriptors is None or keypoints is None:
            logger.warning("员工样本特征不足，跳过: %s", resolved_path)
            continue
        logger.info(
            "员工图库加载 | 姓名=%s | 特征点=%d | 描述子=%d",
            entry.get("name") or resolved_path.stem,
            len(keypoints),
            len(descriptors),
        )
        employee_profiles.append(
            {
                "name": entry.get("name") or resolved_path.stem,
                "descriptors": descriptors.copy(),
                "keypoints": len(keypoints),
                "image_path": str(resolved_path),
            }
        )
        loaded_names.append(entry.get("name") or resolved_path.stem)

    if employee_profiles:
        logger.info(
            "已加载 %d 个模拟员工人脸样本: %s",
            len(employee_profiles),
            loaded_names,
        )
    else:
        logger.warning("未能成功加载任何员工人脸样本，所有分析将按访客处理")


def _prepare_face_roi(
    frame: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    label: str,
) -> np.ndarray:
    """Crop and normalize the region of interest for face matching."""

    if frame is None or frame.size == 0:
        return frame

    frame_height, frame_width = frame.shape[:2]
    x1 = max(x1, 0)
    y1 = max(y1, 0)
    x2 = min(x2, frame_width)
    y2 = min(y2, frame_height)

    if x2 <= x1 or y2 <= y1:
        logger.info(
            "员工比对调试 | 无效ROI | 坐标=(%d,%d,%d,%d) | 标签=%s",
            x1,
            y1,
            x2,
            y2,
            label,
        )
        return frame[0:0, 0:0]

    roi = frame[y1:y2, x1:x2]

    lower_label = label.lower()
    if lower_label == "person":
        height = y2 - y1
        face_height = max(int(height * 0.6), 1)
        roi = frame[y1 : y1 + face_height, x1:x2]

    if roi.size == 0:
        logger.info(
            "员工比对调试 | ROI为空 | 坐标=(%d,%d,%d,%d) | 标签=%s",
            x1,
            y1,
            x2,
            y2,
            label,
        )
        return roi

    # Resize overly large crops to stabilise feature extraction while
    # preserving smaller regions which often come directly from face crops.
    max_dim = 320
    h, w = roi.shape[:2]
    scale = max(h, w) / max_dim
    if scale > 1.2:
        new_size = (max(int(w / scale), 1), max(int(h / scale), 1))
        roi = cv2.resize(roi, new_size, interpolation=cv2.INTER_AREA)

    return roi


def _compute_face_features(image: np.ndarray) -> Tuple[Any, Optional[np.ndarray]]:
    if image is None or image.size == 0:
        return None, None

    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    keypoints, descriptors = face_feature_extractor.detectAndCompute(gray, None)
    if descriptors is None or not keypoints or len(keypoints) < EMPLOYEE_MIN_KEYPOINTS:
        return keypoints, None

    return keypoints, descriptors


def _match_employee_face(
    face_bgr: np.ndarray,
) -> Tuple[Optional[str], float, Dict[str, Any]]:
    debug_payload: Dict[str, Any] = {
        "roi_shape": tuple(face_bgr.shape) if face_bgr is not None else None,
        "keypoints": 0,
        "descriptor_count": 0,
        "profiles": [],
    }

    if not employee_profiles or face_bgr is None or face_bgr.size == 0:
        debug_payload["reason"] = "empty_roi_or_gallery"
        return None, 0.0, debug_payload

    keypoints, descriptors = _compute_face_features(face_bgr)
    debug_payload["keypoints"] = len(keypoints or []) if keypoints is not None else 0
    debug_payload["descriptor_count"] = 0 if descriptors is None else len(descriptors)

    if descriptors is None:
        debug_payload["reason"] = "insufficient_descriptors"
        return None, 0.0, debug_payload

    best_name: Optional[str] = None
    best_score = 0.0

    for profile in employee_profiles:
        stored_descriptors: np.ndarray = profile["descriptors"]
        try:
            matches = face_matcher.match(descriptors, stored_descriptors)
        except cv2.error:  # pragma: no cover - OpenCV matcher guard
            debug_payload["profiles"].append(
                {
                    "name": profile.get("name"),
                    "matches": 0,
                    "good_matches": 0,
                    "similarity": 0.0,
                    "error": "matcher_error",
                }
            )
            continue
        if not matches:
            debug_payload["profiles"].append(
                {
                    "name": profile.get("name"),
                    "matches": 0,
                    "good_matches": 0,
                    "similarity": 0.0,
                    "reason": "no_matches",
                }
            )
            continue
        good_matches = [m for m in matches if m.distance <= EMPLOYEE_DISTANCE_THRESHOLD]
        sample_points = profile.get("keypoints", len(stored_descriptors)) or len(stored_descriptors)
        denominator = float(max(min(len(descriptors), sample_points), 1))
        similarity = len(good_matches) / denominator
        debug_payload["profiles"].append(
            {
                "name": profile.get("name"),
                "matches": len(matches),
                "good_matches": len(good_matches),
                "similarity": float(similarity),
                "candidate_keypoints": sample_points,
            }
        )
        if not good_matches:
            continue
        if similarity > best_score:
            best_score = float(similarity)
            best_name = profile.get("name")

    debug_payload["best_name"] = best_name
    debug_payload["best_similarity"] = best_score
    return best_name, best_score, debug_payload


@app.on_event("startup")
def startup_event() -> None:
    global yolo_model, yolo_class_names, cash_model, cash_class_names, cash_allowed_ids

    if yolo_model is None:
        yolo_model = _load_yolo_model()
        try:
            yolo_class_names = yolo_model.model.names  # type: ignore[attr-defined]
        except AttributeError:
            yolo_class_names = yolo_model.names  # type: ignore[attr-defined]
        try:
            class_names_display = list(yolo_class_names.values())  # type: ignore[union-attr]
        except AttributeError:
            class_names_display = yolo_class_names
        logger.info(
            "已加载 YOLO 模型用于内部员工检测: weights=%s, classes=%s",
            YOLO_WEIGHTS_PATH,
            class_names_display,
        )

    if cash_model is None:
        cash_model = _load_cash_model()
        names_source = (
            getattr(getattr(cash_model, "model", None), "names", None)
            or getattr(cash_model, "names", None)
            or {}
        )
        if isinstance(names_source, dict):
            cash_class_names = {int(idx): str(name) for idx, name in names_source.items()}
        elif isinstance(names_source, (list, tuple)):
            cash_class_names = {idx: str(name) for idx, name in enumerate(names_source)}
        else:
            cash_class_names = {}

        allowed_ids: List[int] = []
        if CASH_ALLOWED_LABELS:
            allowed_ids = [
                idx
                for idx, name in cash_class_names.items()
                if str(name).lower() in CASH_ALLOWED_LABELS
            ]
        elif CASH_ALLOWED_PREFIX:
            allowed_ids = [
                idx
                for idx, name in cash_class_names.items()
                if str(name).lower().startswith(CASH_ALLOWED_PREFIX)
            ]

        if not allowed_ids and cash_class_names:
            allowed_ids = list(cash_class_names.keys())

        cash_allowed_ids = allowed_ids

        logger.info(
            "已加载本地现金检测模型: weights=%s, allowed_class_ids=%s, confidence>=%.2f, iou>=%.2f",
            str(CASH_MODEL_PATH),
            cash_allowed_ids or "全部",
            CASH_MODEL_CONFIDENCE,
            CASH_MODEL_IOU,
        )

    if not employee_profiles:
        _load_employee_gallery()


@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)) -> JSONResponse:
    if cash_model is None or yolo_model is None:
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
        "employee_keyframes": analysis["employee_keyframes"],
        "frame_sampling": analysis["frame_sampling"],
        "employee_match_score": analysis.get("employee_match_score"),
    }

    return JSONResponse(response_payload)


def _run_cash_detection(video_path: Path) -> Dict[str, Any]:
    assert cash_model is not None, "现金检测模型未初始化"
    assert yolo_model is not None, "YOLO 模型未初始化"
    cash_detector = cash_model
    employee_detector = yolo_model

    logger.info(
        "开始分析视频: %s | 现金模型=%s | YOLO权重=%s",
        video_path,
        str(CASH_MODEL_PATH),
        YOLO_WEIGHTS_PATH,
    )

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise ValueError("无法读取上传的视频文件")

    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_seconds = frame_count / fps if fps else 0.0

    frame_interval = max(int(fps * FRAME_SAMPLE_INTERVAL_SECONDS), 1)
    sampled_frames: List[Dict[str, Any]] = []
    employee_keyframes: List[Dict[str, Any]] = []
    collected_objects: Dict[str, float] = {}
    highest_cash_conf = 0.0
    highest_face_conf = 0.0
    best_employee_similarity = 0.0
    best_employee_name: Optional[str] = None

    frame_index = 0
    processed_frames = 0

    cash_detected = False

    while processed_frames < MAX_SAMPLED_FRAMES:
        ret, frame = capture.read()
        if not ret:
            break

        if frame_index % frame_interval != 0:
            frame_index += 1
            continue

        processed_frames += 1
        frame_height, frame_width = frame.shape[:2]

        try:
            cash_results = cash_detector.predict(
                frame,
                conf=CASH_MODEL_CONFIDENCE,
                iou=CASH_MODEL_IOU,
                verbose=False,
            )
        except Exception as exc:  # pragma: no cover - defensive guard against API issues
            capture.release()
            raise RuntimeError("现金检测模型推理失败") from exc

        detections: List[Dict[str, Any]] = []
        annotated_frame = frame.copy()
        face_annotated_frame = frame.copy()
        frame_has_cash = False
        frame_has_employee = False
        face_detections: List[Dict[str, Any]] = []

        if cash_results:
            cash_result = cash_results[0]
            boxes = getattr(cash_result, "boxes", None)
            if boxes is not None:
                xyxy = getattr(boxes, "xyxy", None)
                confidences = getattr(boxes, "conf", None)
                classes = getattr(boxes, "cls", None)
                if xyxy is not None and confidences is not None and classes is not None:
                    coords_list = xyxy.tolist()  # type: ignore[union-attr]
                    conf_list = confidences.tolist()  # type: ignore[union-attr]
                    class_list = classes.tolist()  # type: ignore[union-attr]
                    for idx, coords in enumerate(coords_list):
                        class_id = int(class_list[idx])
                        if cash_allowed_ids and class_id not in cash_allowed_ids:
                            continue

                        label = cash_class_names.get(class_id, str(class_id))
                        confidence = float(conf_list[idx])

                        x1, y1, x2, y2 = [max(int(coord), 0) for coord in coords]
                        x2 = min(x2, frame_width - 1)
                        y2 = min(y2, frame_height - 1)

                        detections.append(
                            {
                                "label": label,
                                "confidence": round(confidence, 4),
                                "box": [x1, y1, x2, y2],
                            }
                        )

                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                        cv2.putText(
                            annotated_frame,
                            f"{label} {confidence:.2f}",
                            (x1, max(y1 - 10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            (0, 255, 255),
                            2,
                        )

                        highest_cash_conf = max(highest_cash_conf, confidence)
                        collected_objects[label] = max(
                            confidence, collected_objects.get(label, 0.0)
                        )
                        collected_objects["Cash / 现金"] = max(
                            confidence, collected_objects.get("Cash / 现金", 0.0)
                        )
                        frame_has_cash = True

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        yolo_results = employee_detector.predict(frame_rgb, verbose=False)[0]
        for box in yolo_results.boxes:
            cls_id = int(box.cls)
            confidence = float(box.conf)
            label = yolo_class_names.get(cls_id, str(cls_id))
            lower_label = label.lower()
            if lower_label in {"person", "face"}:
                highest_face_conf = max(highest_face_conf, confidence)
                x1, y1, x2, y2 = [
                    max(int(coord), 0)
                    for coord in box.xyxy[0].tolist()  # type: ignore[union-attr]
                ]
                x2 = min(x2, frame_width - 1)
                y2 = min(y2, frame_height - 1)
                cv2.rectangle(face_annotated_frame, (x1, y1), (x2, y2), (66, 135, 245), 2)
                cv2.putText(
                    face_annotated_frame,
                    f"{label} {confidence:.2f}",
                    (x1, max(y1 - 10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (66, 135, 245),
                    2,
                )
                face_roi = _prepare_face_roi(frame, x1, y1, x2, y2, label)
                match_name, similarity, match_debug = _match_employee_face(face_roi)
                if match_debug:
                    profile_summaries = match_debug.get("profiles", [])
                    profile_summaries = sorted(
                        profile_summaries,
                        key=lambda item: item.get("similarity", 0.0),
                        reverse=True,
                    )
                    top_profiles = "; ".join(
                        [
                            "{name}:sim={sim:.2f},good={good},total={total}".format(
                                name=entry.get("name") or "未命名",
                                sim=float(entry.get("similarity", 0.0)),
                                good=int(entry.get("good_matches", 0)),
                                total=int(entry.get("matches", 0)),
                            )
                            for entry in profile_summaries[:3]
                        ]
                    ) or "无候选"
                    logger.info(
                        "员工比对调试 | 帧=%d | ROI=%s | 关键点=%d | 描述子=%d | 最佳=%s(%.2f) | 候选=%s",
                        frame_index,
                        match_debug.get("roi_shape"),
                        match_debug.get("keypoints", 0),
                        match_debug.get("descriptor_count", 0),
                        match_debug.get("best_name") or "无",
                        match_debug.get("best_similarity", 0.0),
                        top_profiles,
                    )
                    if match_debug.get("reason"):
                        logger.info(
                            "员工比对调试 | 帧=%d | 原因=%s",
                            frame_index,
                            match_debug.get("reason"),
                        )
                detection_payload: Dict[str, Any] = {
                    "label": label,
                    "confidence": round(confidence, 4),
                    "box": [x1, y1, x2, y2],
                }
                if similarity > 0:
                    detection_payload["match"] = {
                        "name": match_name,
                        "similarity": round(float(similarity), 4),
                    }
                face_detections.append(detection_payload)
                if similarity > best_employee_similarity:
                    best_employee_similarity = float(similarity)
                    best_employee_name = match_name
                frame_has_employee = True
            if lower_label in {"person", "hand", "face"}:
                collected_objects[label] = max(confidence, collected_objects.get(label, 0.0))

        if frame_has_cash and detections:
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
            cash_detected = True

        if frame_has_employee and face_detections:
            _, face_buffer = cv2.imencode(".jpg", face_annotated_frame)
            face_frame_b64 = base64.b64encode(face_buffer).decode("utf-8")
            timestamp_ms = int((frame_index / fps) * 1000) if fps else 0
            frame_match = None
            best_frame_similarity = 0.0
            for detection in face_detections:
                match_payload = detection.get("match") if isinstance(detection, dict) else None
                if not match_payload:
                    continue
                similarity = float(match_payload.get("similarity", 0.0) or 0.0)
                if similarity > best_frame_similarity:
                    best_frame_similarity = similarity
                    frame_match = {
                        "name": match_payload.get("name"),
                        "similarity": round(similarity, 4),
                    }
            employee_keyframes.append(
                {
                    "frame_index": frame_index,
                    "timestamp_ms": timestamp_ms,
                    "mime_type": "image/jpeg",
                    "image_base64": face_frame_b64,
                    "detections": face_detections,
                    **({"match": frame_match} if frame_match else {}),
                }
            )

        frame_index += 1

    capture.release()

    cash_detected = cash_detected or bool(sampled_frames)

    if cash_detected:
        boosted_cash_conf = max(0.95, highest_cash_conf, collected_objects.get("Cash / 现金", 0.0))
        collected_objects["Cash / 现金"] = boosted_cash_conf

    objects_sorted = sorted(collected_objects.items(), key=lambda kv: kv[1], reverse=True)
    top_objects = [f"{label} ({conf:.0%})" for label, conf in objects_sorted[:6]]

    behavior_confidence = 0.6 + 0.2 * min(len(sampled_frames) / max(processed_frames or 1, 1), 1)
    object_confidence = objects_sorted[0][1] if objects_sorted else 0.4

    base_cash_conf = highest_cash_conf or (0.12 if cash_detected else 0.05)
    if cash_detected:
        base_cash_conf = max(base_cash_conf, min(0.98, 0.65 + 0.35 * (highest_cash_conf or 0.5)))

    if best_employee_similarity > 0:
        face_similarity = min(0.2 + best_employee_similarity * 0.75, 0.98)
    else:
        face_similarity = min(0.18 + 0.4 * min(highest_face_conf, 1.0), 0.45)
    internal_employee = best_employee_similarity >= EMPLOYEE_SIMILARITY_THRESHOLD
    matched_employee_name = best_employee_name if internal_employee else None

    response: Dict[str, Any] = {
        "cash_confidence": round(base_cash_conf, 4),
        "cash_keyframes": sampled_frames,
        "employee_keyframes": employee_keyframes,
        "actions": _derive_actions(cash_detected, len(sampled_frames)),
        "objects": top_objects,
        "behavior_confidence": round(min(behavior_confidence, 0.95), 4),
        "object_confidence": round(max(object_confidence, 0.35), 4),
        "internal_employee": internal_employee,
        "face_similarity": round(face_similarity, 4),
        "employee_name": matched_employee_name,
        "employee_match_score": round(best_employee_similarity, 4),
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

    if cash_detected and highest_cash_conf >= CASH_CONFIDENCE_ALERT_THRESHOLD:
        response["alert"] = True
        response["alert_message"] = "⚠️ 检测到疑似现金交易行为"
        response["cash_confidence"] = max(response["cash_confidence"], 0.92)
        if matched_employee_name:
            response["employee_name"] = matched_employee_name
        response["face_similarity"] = max(response["face_similarity"], round(face_similarity, 4))

    logger.info(
        "分析完成: 现金检测=%s, 现金关键帧=%d, 员工关键帧=%d, 最高现金置信度=%.2f, 内部员工=%s, 人脸相似度=%.2f, 最佳匹配=%s(%.2f)",
        cash_detected,
        len(sampled_frames),
        len(employee_keyframes),
        highest_cash_conf,
        response["internal_employee"],
        response["face_similarity"],
        matched_employee_name or "无",
        best_employee_similarity,
    )

    return response


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
