# API 接口文档

> 版本：1.0.0 | 最后更新：2026-05-24

---

## 通用说明

- **基础URL**：`/api`
- **请求头**：`Content-Type: application/json`
- **响应格式**：统一 `{ ok: boolean, data?, error?, meta? }`
- **认证方式**：管理员接口通过 Cookie（session）认证
- **分页参数**：`?page=1&size=10`，返回 `meta` 包含 `total` / `totalPages`

---

## 一、前台公开接口

### 1.1 获取清单列表

```
GET /api/lists?page=1&size=30
```

**响应示例：**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "title": "示例清单",
      "product_code": "PC-001",
      "category": "書籍",
      "author": "发布人甲",
      "image": "/uploads/images/xxx.jpg",
      "status": "published",
      "created_at": "2026-05-24 10:00:00",
      "items": ["项目1", "项目2"],
      "links": [{"title": "相关网站", "url": "http://..."}]
    }
  ],
  "meta": { "page": 1, "size": 30, "total": 5, "totalPages": 1 }
}
```

### 1.2 获取清单详情

```
GET /api/lists/:id
```

### 1.3 搜索清单

```
GET /api/lists/search?q=关键词&page=1&size=10
```

搜索范围：标题、分类、作者（仅已发布的清单）

### 1.4 发布清单

```
POST /api/lists
Content-Type: application/json

{
  "username": "publisher1",
  "password": "pub123",
  "title": "清单名称",
  "product_code": "PC-001",
  "category": "書籍",
  "image": "/uploads/images/xxx.jpg",
  "items": ["项目1", "项目2"],
  "links": [{"title": "名称", "url": "http://..."}]
}
```

**说明**：自动验证发布人身份，自动设置 `status=pending`

### 1.5 获取分类列表

```
GET /api/categories
```

**响应：**
```json
{
  "ok": true,
  "data": [
    { "id": 1, "name": "音樂", "count": 3, "created_at": "..." }
  ]
}
```

### 1.6 获取留言列表

```
GET /api/messages?page=1&size=50
```

（仅返回 `status=approved` 的留言，含 `reply_content` 字段）

### 1.7 提交留言

```
POST /api/messages
{
  "name": "昵称",
  "content": "留言内容"
}
```

### 1.8 获取公开设置

```
GET /api/settings/public
```

返回：`{ site_name, site_intro }`

### 1.9 发布人登录验证

```
POST /api/auth/publisher-login
{
  "username": "publisher1",
  "password": "pub123"
}
```

（不创建 session，仅验证身份）

---

## 二、管理员认证接口

### 2.1 管理员登录

```
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

成功后设置 session Cookie，有效期 24 小时。

### 2.2 管理员退出

```
POST /api/auth/logout
```

### 2.3 检查登录状态

```
GET /api/auth/me
```

---

## 三、后台管理接口

> 以下接口均需管理员登录（session Cookie）

### 3.1 图片上传

```
POST /api/upload/image
Content-Type: multipart/form-data

image: <文件>
```

**限制**：5MB、JPG/PNG/GIF

**响应：**
```json
{ "ok": true, "data": { "url": "/uploads/images/xxx.jpg" } }
```

### 3.2 清单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/lists?page=1&size=100 | 分页获取所有清单 |
| GET | /api/admin/lists/search?q=xxx&page=1&size=100 | 后台搜索（标题/分类/作者/状态/内容） |
| POST | /api/admin/lists | 创建清单（管理员专用，绕过发布人验证） |
| PUT | /api/admin/lists/:id | 更新清单 |
| DELETE | /api/admin/lists/:id | 删除清单 |

### 3.3 留言管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/messages?page=1&size=100 | 分页获取所有留言 |
| PUT | /api/admin/messages/:id | 审核留言 `{ "status": "approved" }` |
| DELETE | /api/admin/messages/:id | 删除留言 |
| PUT | /api/admin/messages/:id/reply | 回复留言 `{ "replyContent": "..." }` |

### 3.4 分类管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/categories | 新增分类 `{ "name": "..." }` |
| DELETE | /api/admin/categories/:id | 删除分类 |

### 3.5 发布人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/publishers | 获取所有发布人 |
| POST | /api/admin/publishers | 创建发布人 `{ "username", "password", "display_name" }` |
| PUT | /api/admin/publishers/:id | 编辑发布人 `{ "display_name", "password", "status" }` |

### 3.6 站点设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/settings | 获取所有设置 |
| PUT | /api/admin/settings | 保存设置 `{ "site_name": "...", "site_intro": "..." }` |
| PUT | /api/admin/password | 修改密码 `{ "password": "..." }` |

---

## 四、错误码

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | VALIDATION_ERROR | 参数验证失败 |
| 400 | INVALID_JSON | 请求体 JSON 格式错误 |
| 400 | FILE_TOO_LARGE | 文件超过大小限制 |
| 401 | UNAUTHORIZED | 未登录 |
| 401 | INVALID_CREDENTIALS | 用户名或密码错误 |
| 403 | AUTH_FAILED | 发布人账号或密码错误 |
| 403 | ACCOUNT_DISABLED | 发布人账号被禁用 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | DUPLICATE | 资源已存在（用户名/分类重复） |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

**错误响应格式：**
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "发布账号或密码错误"
  }
}
```
