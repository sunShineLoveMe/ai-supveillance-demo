# AI 智能柜台监控 Demo 系统

AI 智能柜台监控 Demo 系统是一个基于 **Next.js + Tailwind CSS + Radix UI + ShadCN** 打造的前端演示项目，用于模拟银行柜台视频上传后的多模态 AI 分析流程。系统可在上传视频后触发四大检测：现金交易检测、员工人脸识别、行为分析与物体检测，并在满足条件时提供实时告警与系统日志。

## 技术栈
- [Next.js 16](https://nextjs.org/)（App Router）
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) + [tw-animate-css](https://www.npmjs.com/package/tw-animate-css)
- [Radix UI](https://www.radix-ui.com/) + [ShadCN UI 组件库](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/) 图标
- Next.js API Route 代理后端 FastAPI 服务
- [FastAPI](https://fastapi.tiangolo.com/) + [YOLOv8n](https://docs.ultralytics.com/models/yolov8/) 现金检测推理后端

## 目录结构
```
app/
  api/analyze/route.ts        # Next.js API Route，负责代理后端 AI 服务并提供本地模拟数据
  globals.css                 # Tailwind 全局样式与告警动画定义
  layout.tsx / page.tsx       # 应用布局与主界面逻辑
components/
  result-card.tsx             # 分析结果卡片通用组件
  multi-results-display.tsx   # 四种检测结果展示逻辑
  single-video-upload.tsx     # 拖拽/上传视频组件
  system-log.tsx              # 可折叠系统日志，展示原始 JSON 和事件时间线
  ui/                         # ShadCN UI 组件集合
backend/
  main.py                     # FastAPI + YOLOv8n 推理服务
  requirements.txt            # Python 依赖列表
public/
styles/
```

## 功能概览
- 📁 **视频上传与预览**：支持拖拽或点击上传 `.mp4/.mov` 等视频，并提供 `<video>` 预览。
- 🤖 **AI 检测调用**：点击「开始 AI 分析」后调用 `/api/analyze`，自动转发至 FastAPI 模型服务，支持环境变量配置；若后端不可用则回退到内置模拟数据。
- 📊 **四大检测结果**：
  - 现金交易检测：Radix Progress 显示概率，并根据阈值展示不同状态标签。
  - 员工人脸识别：显示匹配度与匹配员工信息。
  - 行为分析：列表化展示检测到的行为，并提供置信度条。
  - 物体检测：展示识别到的目标标签与识别置信度。
- 🖼️ **现金关键帧回放**：FastAPI + YOLOv8n 逐帧采样识别现金/手部接触，返回带有框选结果的关键帧缩略图，前端即时呈现。
- 🚨 **智能告警**：当现金概率 ≥ 0.9 且员工相似度 ≥ 0.85 时，标题区与相关卡片触发红色闪烁动画，并弹出告警横幅。
- 📝 **系统日志**：可折叠区域展示 AI 返回的原始 JSON 以及按时间排序的事件日志，支持中英文切换。
- 🌐 **多语言支持**：所有界面文案支持中英文一键切换。

## 快速开始
1. **安装依赖**
   ```bash
   pnpm install
   ```
2. **启动开发环境**
   ```bash
   pnpm dev
   ```
3. **访问页面**：浏览器打开 `http://localhost:3000`。
4. **启动 YOLOv8n FastAPI 后端（推荐）**：
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows 使用 .venv\\Scripts\\activate
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
5. **配置前端代理（可选）**：
   - 在环境变量中配置 `ANALYZE_API_URL`（或 `AI_BACKEND_URL` / `NEXT_PUBLIC_ANALYZE_API_URL`）指向 FastAPI 推理接口。
   - 若未配置或后端异常，前端会自动返回模拟数据，便于无后端情况下的演示。

## 使用流程
1. 点击上传或拖拽一段银行柜台监控视频。
2. 预览确认后点击「开始 AI 分析」。
3. 等待后端返回四种检测结果，页面自动更新结果卡片与系统日志。
4. 若触发内部员工现金交易条件，顶部会显示闪烁的红色告警提示。
5. 打开「系统日志」可查看 AI 返回的原始 JSON 以及事件时间线。

## AI 分析数据结构
后端 `/api/analyze` 接口返回如下 JSON（示例）：
```json
{
  "cash_transaction": true,
  "cash_confidence": 0.93,
  "internal_employee": true,
  "face_similarity": 0.88,
  "employee_name": "张三",
  "actions": ["频繁手部运动", "递交文件"],
  "objects": ["人物", "柜台", "文件夹"],
  "alert": true,
  "alert_message": "⚠️ 检测到内部员工现金交易",
  "behavior_confidence": 0.86,
  "object_confidence": 0.90,
  "cash_keyframes": [
    {
      "frame_index": 42,
      "timestamp_ms": 5200,
      "mime_type": "image/jpeg",
      "image_base64": "...",
      "detections": [
        { "label": "Cash Bundle", "confidence": 0.93, "box": [12, 10, 88, 72] }
      ]
    }
  ],
  "frame_sampling": {
    "fps": 24,
    "total_frames": 480,
    "duration_seconds": 20.0,
    "processed_frames": 12,
    "sample_interval_frames": 12,
    "generated_at": "2025-03-01T12:00:00Z"
  }
}
```
> 若字段缺失，前端会自动回退到默认值并仍可正常显示。

## 已完成功能清单
- [x] Next.js 单页应用与整体布局
- [x] 视频上传、拖拽、预览及状态管理
- [x] `/api/analyze` API Route 代理与容错回退
- [x] 四种检测卡片 + 通用 ResultCard 组件 + Radix Progress 展示
- [x] 告警动画（标题区 & 卡片闪烁、横幅提示）
- [x] 系统日志折叠面板（原始 JSON + 多语言时间线）
- [x] 中英文界面切换
- [x] FastAPI + YOLOv8n 现金检测推理、关键帧抓取与前端可视化

## 后续可扩展方向
- 集成实时 WebSocket 推送以展示持续监控结果
- 增加操作审计、导出报告等高级管理功能
- 与真实身份库、交易系统对接实现联动告警

欢迎根据业务需求继续扩展或接入真实模型服务。
