# AI 智能柜台监控 Demo 系统

AI 智能柜台监控 Demo 系统是一个基于 **Next.js + Tailwind CSS + Radix UI + ShadCN** 打造的前端演示项目，用于模拟银行柜台视频上传后的多模态 AI 分析流程。系统可在上传视频后触发四大检测：现金交易检测、员工人脸识别、行为分析与物体检测，并在满足条件时提供实时告警与系统日志。

## 技术栈
- [Next.js 16](https://nextjs.org/)（App Router）
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) + [tw-animate-css](https://www.npmjs.com/package/tw-animate-css)
- [Radix UI](https://www.radix-ui.com/) + [ShadCN UI 组件库](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/) 图标
- Next.js API Route 代理后端 FastAPI 服务
- [FastAPI](https://fastapi.tiangolo.com/) + [Roboflow Inference](https://roboflow.com/) 现金检测推理后端（结合 YOLOv8n 辅助人脸/人员识别）

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
  main.py                     # FastAPI 服务（Roboflow 现金检测 + YOLOv8n 人脸/人员识别）
  requirements.txt            # Python 依赖列表
public/
styles/
```

## 功能概览
- 📁 **视频上传与预览**：支持拖拽或点击上传 `.mp4/.mov` 等视频，并提供 `<video>` 预览。
- 🤖 **AI 检测调用**：点击「开始 AI 分析」后调用 `/api/analyze`，自动转发至 FastAPI 模型服务，支持环境变量配置；若后端不可用则回退到内置模拟数据。
- 📊 **四大检测结果**：
  - 现金交易检测：Radix Progress 显示概率，并根据阈值展示不同状态标签，同时在分析摘要中合并展示 "Cash / 现金" 置信度。
  - 员工人脸识别：显示匹配度与匹配员工信息。
  - 行为分析：列表化展示检测到的行为，并提供置信度条。
  - 物体检测：展示识别到的目标标签与识别置信度，并对现金相关标签以黄色圆角徽标强调。
- 🖼️ **现金与员工关键帧回放**：FastAPI 调用 Roboflow 现金交易微调模型逐帧识别人民币并以黄色框高亮，同时并行使用 YOLOv8n 抓取人员/人脸信息，前端左侧展示疑似现金关键帧，右侧展示疑似员工关键帧，均支持点击缩略图放大查看检测详情。
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
4. **配置后端推理环境（推荐）**：
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows 使用 .venv\\Scripts\\activate
   pip install -r backend/requirements.txt
   export ROBOFLOW_API_KEY="<你的 Roboflow API Key>"
   # 可选：export ROBOFLOW_MODEL_ID="currency-deteection-pq4mu/1"
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
5. **配置前端代理（可选）**：
   - 开发模式下，前端会自动尝试连接 `http://127.0.0.1:8000/analyze`，无需额外配置即可访问本机 FastAPI 服务。
   - 若后端部署在其他地址，请在环境变量中设置 `ANALYZE_API_URL`（或 `AI_BACKEND_URL` / `NEXT_PUBLIC_ANALYZE_API_URL`），支持填写完整地址或基础域名（会自动补全 `/analyze` 路径）。
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
  "employee_match_score": 0.66,
  "actions": ["频繁手部运动", "递交文件"],
  "objects": ["Cash / 现金 (93%)", "Person / 人物 (90%)", "Counter / 柜台 (78%)", "Folder / 文件夹 (65%)"],
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
  "employee_keyframes": [
    {
      "frame_index": 40,
      "timestamp_ms": 5000,
      "mime_type": "image/jpeg",
      "image_base64": "...",
      "match": { "name": "张三", "similarity": 0.66 },
      "detections": [
        {
          "label": "Person",
          "confidence": 0.88,
          "box": [22, 18, 84, 96],
          "match": { "name": "张三", "similarity": 0.66 }
        }
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

- `employee_match_score`：后端直接返回的匹配得分（0~1），表示与员工图库的 ORB 特征匹配比例。
- `employee_keyframes[].match` / `employee_keyframes[].detections[].match`：标注当前关键帧或检测框对应的员工姓名与匹配得分，便于对照。

## 准备模拟员工人脸数据

后端会在启动时从 `backend/employee_gallery` 目录读取模拟员工人脸样本，流程如下：

1. 仓库仅提供空的 `registry.json` 占位文件，请在本地自行准备模拟员工照片并放入 `backend/employee_gallery` 目录。
2. 将真实的内部员工模拟数据（例如题述中的柜员截图）命名为合适的文件名，并在 `registry.json` 中维护数组，例如：
   ```json
   [
     { "name": "柜员王敏", "image": "employee_wangmin.jpg" }
   ]
   ```
3. 确保 `image` 字段与放置在目录中的文件名一致，否则后端会在启动日志中提示无法读取对应样本。
4. 可通过环境变量覆盖默认路径或阈值：
   - `EMPLOYEE_GALLERY_DIR`：自定义图库目录；
   - `EMPLOYEE_SIMILARITY_THRESHOLD`：匹配判定阈值（默认 0.32，已放宽以更容易命中真实员工）；
   - `EMPLOYEE_MIN_KEYPOINTS` / `EMPLOYEE_DISTANCE_THRESHOLD`：ORB 特征过滤策略（默认距离阈值 60，用于纳入更多可用匹配对）。
5. 后端启动日志会输出载入的样本列表，若目录为空则所有访客都会按外部人员处理，不再误判为内部员工。

## 人脸相似度分析流程

1. **统一帧采样**：现金检测与人脸检测共享同一套帧采样逻辑（可配置的帧间隔与最大帧数），确保两个结果面板在时间线上保持对齐。
2. **YOLOv8n 抓取候选框**：每一帧会送入 YOLOv8n（COCO 权重）模型，筛选 `person` / `face` 类别，获取候选人脸/上半身的边界框。
3. **ORB 特征提取**：依据 YOLO 的边界框截取 ROI，转换为灰度后用 ORB（`EMPLOYEE_MAX_FEATURES`）提取关键点与描述子，过滤掉特征点不足的帧。
4. **员工图库匹配**：将 ROI 特征与 `backend/employee_gallery` 中的每个样本进行 BFMatcher（汉明距离）比对，统计距离阈值以内的有效匹配数，形成 `employee_match_score`。
5. **相似度换算与判定**：将匹配得分映射为 0~1 的 `face_similarity`，当得分 ≥ `EMPLOYEE_SIMILARITY_THRESHOLD`（默认 0.32，可按需调整）时判定为内部员工，否则视为访客。
6. **关键帧与日志**：命中员工样本的帧会附带 `match` 元信息写入 `employee_keyframes`，系统日志也会输出最佳匹配姓名与得分，便于复核。

> 若图库为空或未命中任何样本，`internal_employee` 会保持 `false`，避免出现全部视频都被识别为内部员工的情况。

## 已完成功能清单
- [x] Next.js 单页应用与整体布局
- [x] 视频上传、拖拽、预览及状态管理
- [x] `/api/analyze` API Route 代理与容错回退
- [x] 四种检测卡片 + 通用 ResultCard 组件 + Radix Progress 展示
- [x] 告警动画（标题区 & 卡片闪烁、横幅提示）
- [x] 系统日志折叠面板（原始 JSON + 多语言时间线）
- [x] 中英文界面切换
- [x] FastAPI + Roboflow 现金检测推理（黄色高亮人民币）与 YOLOv8n 人员检测、关键帧抓取和前端可视化（支持关键帧放大查看）

## 后续可扩展方向
- 集成实时 WebSocket 推送以展示持续监控结果
- 增加操作审计、导出报告等高级管理功能
- 与真实身份库、交易系统对接实现联动告警

欢迎根据业务需求继续扩展或接入真实模型服务。

## 常见问题排查

- [GitHub `Binary files are not supported` 报错无法 Update branch](docs/TROUBLESHOOTING.md)：说明了为何网页端会拒绝二进制冲突并给出在本地解决冲突、重新推送分支的完整步骤，可用于当前二进制占位图或锁文件引发的冲突场景。
