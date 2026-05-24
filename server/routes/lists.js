// ============================================================
// 清单 API 路由
// 职责：处理所有与清单相关的 HTTP 请求
// 路由前缀：/api/lists（公开） /api/admin/lists（需管理员登录）
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // ---- 前台公开接口 ----

  // 分页获取已发布的清单列表
  app.get('/api/lists', function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 10;
    var result = db.getPublishedLists(page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 搜索已发布的清单（关键词搜索标题、分类、作者）
  app.get('/api/lists/search', function (req, res) {
    var q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ ok: true, data: [], meta: { total: 0 } });
    }
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 10;
    var result = db.searchLists(q, page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 根据 ID 获取清单详情
  app.get('/api/lists/:id', function (req, res) {
    var list = db.getListById(parseInt(req.params.id));
    if (!list) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '清单不存在' } });
    }
    res.json({ ok: true, data: list });
  });

  // 发布新清单（需验证发布人身份）
  app.post('/api/lists', function (req, res) {
    var body = req.body;

    // 第一步：验证发布人账号密码
    if (!body.username || !body.password) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '请输入发布账号和密码' } });
    }
    var pub = db.authenticatePublisher(body.username, body.password);
    if (!pub) {
      return res.status(403).json({ ok: false, error: { code: 'AUTH_FAILED', message: '发布账号或密码错误' } });
    }
    if (pub.status !== 'active') {
      return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_DISABLED', message: '该发布账号已被禁用，请联系管理员' } });
    }

    // 第二步：验证必填字段
    if (!body.title || !body.category || !body.items || body.items.length === 0) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '名称、分类、内容为必填项' } });
    }

    // 第三步：自动填充作者名和状态
    body.author = pub.display_name;   // 使用发布人的显示名称
    body.status = 'pending';          // 前台发布默认待审核
    var id = db.createList(body);
    res.status(201).json({ ok: true, data: { id: id } });
  });

  // ---- 后台管理接口（需管理员登录）----
  var requireAdmin = require('../middleware/auth').requireAdmin;

  // 分页获取所有清单（含待审核和草稿）
  app.get('/api/admin/lists', requireAdmin, function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 100;
    var result = db.getAllListsPaged(page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 后台搜索清单（搜索范围更广：标题、分类、作者、状态、清单内容）
  app.get('/api/admin/lists/search', requireAdmin, function (req, res) {
    var q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ ok: true, data: [], meta: { total: 0 } });
    }
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 100;
    var result = db.searchAdminLists(q, page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 管理员创建清单（绕过发布人验证）
  app.post('/api/admin/lists', requireAdmin, function (req, res) {
    var body = req.body;
    if (!body.title || !body.category || !body.items || body.items.length === 0) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '名称、分类、内容为必填项' } });
    }
    body.author = body.author || '管理员';
    var id = db.createList(body);
    res.status(201).json({ ok: true, data: { id: id } });
  });

  // 编辑清单
  app.put('/api/admin/lists/:id', requireAdmin, function (req, res) {
    var id = parseInt(req.params.id);
    var list = db.getListById(id);
    if (!list) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '清单不存在' } });
    }
    db.updateList(id, req.body);
    res.json({ ok: true });
  });

  // 删除清单
  app.delete('/api/admin/lists/:id', requireAdmin, function (req, res) {
    var id = parseInt(req.params.id);
    db.deleteList(id);
    res.json({ ok: true });
  });
};
