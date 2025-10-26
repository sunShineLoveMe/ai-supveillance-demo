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
from inference import get_model
from ultralytics import YOLO

APP_TITLE = "AI Smart Counter Monitor Backend"
APP_VERSION = "1.0.0"

MAX_SAMPLED_FRAMES = int(os.getenv("MAX_SAMPLED_FRAMES", "24"))
FRAME_SAMPLE_INTERVAL_SECONDS = float(os.getenv("FRAME_SAMPLE_INTERVAL_SECONDS", "0.5"))
YOLO_WEIGHTS_PATH = os.getenv("YOLO_WEIGHTS", "yolov8n.pt")
CASH_CONFIDENCE_ALERT_THRESHOLD = float(os.getenv("CASH_CONFIDENCE_THRESHOLD", "0.3"))
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "currency-deteection-pq4mu/1")
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_CONFIDENCE = float(os.getenv("ROBOFLOW_CONFIDENCE", "0.08"))
ROBOFLOW_IOU = float(os.getenv("ROBOFLOW_IOU", "0.1"))
ROBOFLOW_CASH_PREFIX = os.getenv("ROBOFLOW_CASH_PREFIX", "chinese yuan").lower()

EMPLOYEE_GALLERY_DIR = Path(
    os.getenv("EMPLOYEE_GALLERY_DIR", Path(__file__).parent / "employee_gallery")
)
EMPLOYEE_REGISTRY_FILE = Path(
    os.getenv("EMPLOYEE_REGISTRY_FILE", EMPLOYEE_GALLERY_DIR / "registry.json")
)
EMPLOYEE_SIMILARITY_THRESHOLD = float(os.getenv("EMPLOYEE_SIMILARITY_THRESHOLD", "0.38"))
EMPLOYEE_MIN_KEYPOINTS = int(os.getenv("EMPLOYEE_MIN_KEYPOINTS", "10"))
EMPLOYEE_DISTANCE_THRESHOLD = float(os.getenv("EMPLOYEE_DISTANCE_THRESHOLD", "48"))
EMPLOYEE_MAX_FEATURES = int(os.getenv("EMPLOYEE_MAX_FEATURES", "512"))


logger = logging.getLogger("uvicorn.error")


def _load_yolo_model() -> YOLO:
    weights_path = Path(YOLO_WEIGHTS_PATH)
    if not weights_path.exists():
        # allow ultralytics to download default weights automatically
        return YOLO(YOLO_WEIGHTS_PATH)
    return YOLO(str(weights_path))


def _load_cash_model():
    if not ROBOFLOW_API_KEY:
        raise RuntimeError("ROBOFLOW_API_KEY 环境变量未配置，无法加载现金检测模型")
    return get_model(model_id=ROBOFLOW_MODEL_ID, api_key=ROBOFLOW_API_KEY)


yolo_model: Optional[YOLO] = None
yolo_class_names: Dict[int, str] = {}
cash_model: Any | None = None
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


def _match_employee_face(face_bgr: np.ndarray) -> Tuple[Optional[str], float]:
    if not employee_profiles or face_bgr is None or face_bgr.size == 0:
        return None, 0.0

    _, descriptors = _compute_face_features(face_bgr)
    if descriptors is None:
        return None, 0.0

    best_name: Optional[str] = None
    best_score = 0.0

    for profile in employee_profiles:
        stored_descriptors: np.ndarray = profile["descriptors"]
        try:
            matches = face_matcher.match(descriptors, stored_descriptors)
        except cv2.error:  # pragma: no cover - OpenCV matcher guard
            continue
        if not matches:
            continue
        good_matches = [m for m in matches if m.distance <= EMPLOYEE_DISTANCE_THRESHOLD]
        if not good_matches:
            continue
        denominator = float(max(len(descriptors), profile.get("keypoints", len(stored_descriptors))))
        similarity = len(good_matches) / denominator
        if similarity > best_score:
            best_score = float(similarity)
            best_name = profile.get("name")

    return best_name, best_score


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
        names = getattr(cash_model, "class_names", None) or {}
        # roboflow inference models expose class names as a dict keyed by index
        cash_class_names = {int(idx): name for idx, name in names.items()} if isinstance(names, dict) else {}
        cash_allowed_ids = [
            idx for idx, name in cash_class_names.items() if str(name).lower().startswith(ROBOFLOW_CASH_PREFIX)
        ]
        if not cash_allowed_ids and cash_class_names:
            cash_allowed_ids = list(cash_class_names.keys())
        logger.info(
            "已加载 Roboflow 现金检测模型: model_id=%s, allowed_class_ids=%s, confidence>=%.2f, iou>=%.2f",
            getattr(cash_model, "model_id", ROBOFLOW_MODEL_ID),
            cash_allowed_ids,
            ROBOFLOW_CONFIDENCE,
            ROBOFLOW_IOU,
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


def _normalize_prediction(pred: Any) -> Dict[str, Any]:
    """Convert Roboflow/ObjectDetection predictions into a dictionary."""

    if isinstance(pred, dict):
        return pred

    for attr in ("model_dump", "dict"):
        method = getattr(pred, attr, None)
        if callable(method):
            try:
                data = method()
            except Exception:  # pragma: no cover - defensive against SDK changes
                data = None
            if isinstance(data, dict):
                return data

    data: Dict[str, Any] = {}

    def _copy_attr(target_key: str, *source_keys: str) -> None:
        for key in source_keys:
            if hasattr(pred, key):
                value = getattr(pred, key)
                if value is not None:
                    data[target_key] = value
                    return

    _copy_attr("class_id", "class_id", "classId", "classID")
    _copy_attr("class", "class_name", "className", "class_label", "class_label_name", "class_", "class")
    _copy_attr("confidence", "confidence", "score", "probability")
    _copy_attr("x", "x", "x_center", "xc")
    _copy_attr("y", "y", "y_center", "yc")
    _copy_attr("width", "width", "w")
    _copy_attr("height", "height", "h")

    bbox = getattr(pred, "bounding_box", None) or getattr(pred, "bbox", None)
    if bbox is not None:
        bbox_dict: Dict[str, Any] | None = None
        if isinstance(bbox, dict):
            bbox_dict = bbox
        else:
            for attr in ("model_dump", "dict"):
                method = getattr(bbox, attr, None)
                if callable(method):
                    try:
                        bbox_dict = method()
                    except Exception:  # pragma: no cover - defensive
                        bbox_dict = None
                    if isinstance(bbox_dict, dict):
                        break
        if isinstance(bbox_dict, dict):
            data.setdefault("x", bbox_dict.get("x") or bbox_dict.get("x_center"))
            data.setdefault("y", bbox_dict.get("y") or bbox_dict.get("y_center"))
            data.setdefault("width", bbox_dict.get("width"))
            data.setdefault("height", bbox_dict.get("height"))

    return data


def _run_cash_detection(video_path: Path) -> Dict[str, Any]:
    assert cash_model is not None, "现金检测模型未初始化"
    assert yolo_model is not None, "YOLO 模型未初始化"

    logger.info(
        "开始分析视频: %s | 现金模型=%s | YOLO权重=%s",
        video_path,
        getattr(cash_model, "model_id", ROBOFLOW_MODEL_ID),
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
            inference_results = cash_model.infer(
                frame,
                confidence=ROBOFLOW_CONFIDENCE,
                iou_threshold=ROBOFLOW_IOU,
            )[0]
        except Exception as exc:  # pragma: no cover - defensive guard against API issues
            capture.release()
            raise RuntimeError("现金检测模型推理失败") from exc

        if isinstance(inference_results, dict):
            predictions = inference_results.get("predictions", [])
        else:
            predictions = getattr(inference_results, "predictions", [])
        if not isinstance(predictions, list):
            predictions = []
        detections: List[Dict[str, Any]] = []
        annotated_frame = frame.copy()
        face_annotated_frame = frame.copy()
        frame_has_cash = False
        frame_has_employee = False
        face_detections: List[Dict[str, Any]] = []

        for pred in predictions:
            pred_data = _normalize_prediction(pred)
            try:
                class_id = int(pred_data.get("class_id", -1))
            except (TypeError, ValueError):
                class_id = -1

            label = cash_class_names.get(class_id, pred_data.get("class", str(class_id)))
            confidence = float(pred_data.get("confidence", 0.0) or 0.0)

            if cash_allowed_ids and class_id not in cash_allowed_ids:
                continue

            x_center = float(pred_data.get("x", 0.0) or 0.0)
            y_center = float(pred_data.get("y", 0.0) or 0.0)
            width = float(pred_data.get("width", 0.0) or 0.0)
            height = float(pred_data.get("height", 0.0) or 0.0)

            x1 = max(int(x_center - width / 2), 0)
            y1 = max(int(y_center - height / 2), 0)
            x2 = min(int(x_center + width / 2), frame_width - 1)
            y2 = min(int(y_center + height / 2), frame_height - 1)

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
            collected_objects[label] = max(confidence, collected_objects.get(label, 0.0))
            collected_objects["Cash / 现金"] = max(confidence, collected_objects.get("Cash / 现金", 0.0))
            frame_has_cash = True

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        yolo_results = yolo_model.predict(frame_rgb, verbose=False)[0]
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
                y_slice_end = min(y2 + 1, frame_height)
                x_slice_end = min(x2 + 1, frame_width)
                face_roi = frame[max(y1, 0) : y_slice_end, max(x1, 0) : x_slice_end]
                match_name, similarity = _match_employee_face(face_roi)
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
