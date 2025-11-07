# 数据模型设计器

基于 **Next.js 14 + React 18 + shadcn/ui + Prisma + MySQL** 的数据模型统一管理平台，支持从零构建数据存储、数据视图、数据表单以及数据操作模型。

## 功能特性

- **数据存储模型**：
  - 通过输入 MySQL 数据库连接信息，一键导入库内所有数据表与字段元数据；
  - 自动生成存储模型及数据表结构，后续可用于视图、表单、操作模型的二次设计。
- **数据展示视图**：
  - 基于数据存储模型选择数据表与字段，快速生成列表视图配置；
  - 支持设置字段展示名称、类型及排序能力等元信息。
- **数据提交表单**：
  - 选择数据表字段并定义控件类型、校验规则，生成可复用的表单模型；
  - 支持配置字段是否必填、控件类型（文本、数值、下拉等）。
- **数据操作模型**：
  - 设计 CRUD 或自定义接口操作，可选绑定表单模型自动生成请求参数结构；
  - 支持维护请求/响应 JSON 结构，统一管理接口契约。
- **业务领域模型**：
  - 聚合业务字段、表单、视图与操作模型，形成完整的业务域描述；
  - 支持自定义业务字段元信息，并关联现有模型资源。
- **统一工作台**：
  - 使用 shadcn/ui 组件库构建现代化界面；
  - Tab 分栏展示存储、视图、表单、操作、领域五类模型，支持实时刷新查看最新配置。

## 技术栈

- **前端**：Next.js 14 (App Router)、React 18、TypeScript、TailwindCSS、shadcn/ui
- **后端**：Next.js Route Handlers、Prisma ORM、MySQL
- **其他**：mysql2（数据库元数据获取）、sonner（全局消息提醒）、zod（参数校验）

## 快速开始

1. 安装依赖：

   ```bash
   npm install
   ```

2. 配置环境变量：复制 `.env.example` 为 `.env` 并填写实际的 MySQL 连接字符串。

   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/data_model_designer"
   ```

3. 执行数据库迁移与 Prisma Client 生成：

   ```bash
   npx prisma db push
   npm run prisma:generate
   ```

4. 启动开发环境：

   ```bash
   npm run dev
   ```

5. 访问 `http://localhost:3000`，即可使用数据模型设计器：

   - 在「数据存储模型」标签页连接真实数据库，自动生成存储模型；
   - 基于生成的存储模型设计视图、表单和操作模型，实现统一管理。

## 目录结构

```
app/
  api/
    dashboard/                # 仪表盘数据聚合接口
    storage-models/           # 数据存储模型接口（含数据库导入）
    view-models/              # 视图模型接口
    form-models/              # 表单模型接口
    operation-models/         # 操作模型接口
  layout.tsx                  # 全局布局
  page.tsx                    # 首页工作台
components/
  dashboard/                  # 工作台核心组件
  ui/                         # 基于 shadcn 的 UI 组件封装
lib/
  prisma.ts                   # Prisma Client 单例
  serializers.ts              # 数据序列化工具
  utils.ts                    # 通用工具函数
prisma/
  schema.prisma               # 数据模型定义
```

## 后续扩展建议

- 为导入的存储模型新增字段级别的编辑能力，如手动补充索引信息；
- 在操作模型中支持自动生成接口模拟数据或 OpenAPI 文档；
- 引入角色权限控制，实现多人协作的模型管理；
- 结合低代码引擎，生成可运行的前端/后端代码模板。

欢迎根据业务诉求继续扩展完善！
