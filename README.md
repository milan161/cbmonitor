# CBMonitor — 可转债数据采集与策略监控系统

> 一个**独立自主**的可转债投资辅助决策系统：从公开数据源采集基础行情，**自己计算**所有衍生指标（双低、到期收益率、弹性、触发价等），复现集思录两位大佬（老实和尚、检钢蹦）的选债策略，支持本地运行与云端部署。

## 项目由来

投资者跟集思录两位大佬做可转债策略，但集思录的核心指标（期权价值、到期收益、回售收益等）是会员付费内容。本项目的设计原则是：

1. **不爬集思录/宁稳网**——它们也只是"交易所 → 东方财富/新浪 → 自己算衍生指标"链条上的中间商，其计算结果完全可以自己复现。
2. **数据直取源头**：AKShare（东方财富封装）+ 新浪财经 + 东方财富数据中心直连 API。
3. **衍生指标自主计算**：双低值、税前到期收益率（阶梯利率 IRR）、弹性、触发价、纯债价值全部自己算，算法可控可审计。

## 快速开始（本地）

```bat
:: 1. 安装后端依赖（Python 3.11，系统 Python 即可）
cd backend && pip install -r requirements.txt

:: 2. 安装前端依赖
cd ..\frontend && npm install

:: 3. 一键启动（后端 :8100 + 前端 :5174，自动开浏览器）
cd .. && start_cb.bat

:: 4. 首次使用：点页面右上角"手动刷新"触发采集（约30秒）
```

- 本地看板：http://localhost:5174
- API 文档：http://127.0.0.1:8100/docs
- 线上看板：https://9eastray.com/cb （见 `docs/005_部署与运维.md`）

## 目录结构

```
CBMonitor/
├── start_cb.bat              本地一键启动脚本
├── database/                 🔴 数据库目录（与 src/ 平级 · 仓库外 · 物理隔离）
│   └── cb_monitor.db         SQLite 数据库（每日快照，WAL 模式）
├── src/                      源码仓库根（= git 仓库根，只放源码）
│   ├── backend/              FastAPI 后端（端口 8100）
│   │   ├── main.py           应用入口 + API 路由
│   │   ├── requirements.txt
│   │   ├── models/
│   │   │   ├── database.py   SQLAlchemy ORM + CBDatabaseManager（连接 database/cb_monitor.db）
│   │   │   └── schemas.py    Pydantic 视图模型（BondVO 等）
│   │   └── services/
│   │       ├── data_collector.py 三源采集 + 过滤 + 衍生指标编排
│   │       ├── calc_engine.py    纯计算引擎（IRR/现金流/双低/弹性/BS期权）
│   │       └── strategy_engine.py  A策略集(老实和尚) + B策略集(检钢蹦)
│   └── frontend/             Vue3 + Vite 前端（端口 5174）
│       └── src/
│           ├── App.vue       三 Tab 布局 + 筛选栏
│           ├── api/index.ts  Axios 封装（本地/线上路径自适应）
│           └── components/CBTable.vue  核心数据表格（排序/涨跌色/sticky表头）
└── deploy/                   服务器部署配置（systemd + nginx）
    ├── cbmonitor.service
    └── arbmini.conf.current
```

> ⚠️ **库路径**：`<程序根>/database/cb_monitor.db`，由 `src/backend/models/database.py` 用
> 「双端判定」算出（本地程序根 = `src/` 的父；ARM 扁平布局 = `backend/` 的父）。
> **绝不要**把库放回 `src/` 内（会进 git 仓库 + 被推上 ARM 覆盖生产库）。

## 文档索引

| 文档 | 内容 |
|------|------|
| [001_架构设计](docs/001_架构设计.md) | 分层架构、数据流、与 arbTest 项目的关系与融合规划 |
| [002_数据源与采集](docs/002_数据源与采集.md) | 三个数据源详解、字段映射表、过滤规则、**踩坑记录** |
| [003_计算引擎与策略](docs/003_计算引擎与策略.md) | IRR/现金流算法、A/B 策略集参数与核对结论、已知差距 |
| [004_API与前端](docs/004_API与前端.md) | REST 路由、数据库表结构、Vue 组件、UI 约定、**手机端适配规则** |
| [005_部署与运维](docs/005_部署与运维.md) | 本地/服务器部署、nginx 路由、常见问题排查 |
| [006_部署与前端适配实操](docs/006_部署与前端适配实操.md) | 本次部署实录、手机端适配过程、五个坑、排障手册 |

## 当前状态（2026-09）

- ✅ 三源采集稳定运行，约 304 只活跃转债
- ✅ A策略集四策略与老实和尚帖子核对通过（2026-08-10）
- ✅ 已部署至 9eastray.com/cb（ARM 服务器 + nginx + Cloudflare）
- ✅ 手机端已适配（2026-09-27）：顶栏换行、表格横滚 + 冻结「代码/名称」列，六档机型零横向溢出
- ⚠️ 缺"公告强赎"剔除逻辑（数据源待解决，详见 003 文档）
- ⚠️ B策略集（检钢蹦）参数为初版，未与实盘核对
