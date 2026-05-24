// ============================================================
// 发布人管理 API 路由
// 职责：处理发布人账号的增、删、改、查和登录验证
// 说明：发布人由管理员手动创建，没有自主注册功能
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // ---- 后台管理接口（需管理员登录）----
  var requireAdmin = require('../middleware/auth').requireAdmin;

  // 获取所有发布人列表（不返回密码）
  app.get('/api/admin/publishers', requireAdmin, function (req, res) {
    var list = db.getAllPublishers();
    res.json({ ok: true, data: list });
  });

  // 新增发布人
  app.post('/api/admin/publishers', requireAdmin, function (req, res) {
    var body = req.body;
    // 验证用户名和密码
    if (!body.username || !body.password) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
    }
    if (body.username.length < 2 || body.username.length > 30) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '用户名长度应在2-30个字符之间' } });
    }
    if (body.password.length < 4) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '密码至少4个字符' } });
    }
    var ok = db.addPublisher({
      username: body.username,
      password: body.password,
      display_name: body.display_name || body.username,
      status: 'active'
    });
    if (!ok) {
      return res.status(409).json({ ok: false, error: { code: 'DUPLICATE', message: '用户名已存在' } });
    }
    res.status(201).json({ ok: true });
  });

  // 编辑发布人（可修改显示名称、密码、状态）
  app.put('/api/admin/publishers/:id', requireAdmin, function (req, res) {
    var id = parseInt(req.params.id);
    var existing = db.getPublisherById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '发布人不存在' } });
    }
    var data = {};
    if (req.body.display_name !== undefined) data.display_name = req.body.display_name;
    if (req.body.password) data.password = req.body.password;
    if (req.body.status !== undefined) data.status = req.body.status;
    db.updatePublisher(id, data);
    res.json({ ok: true });
  });

  // ---- 发布人登录验证 ----
  // 不创建 session，每次发布独立验证
  app.post('/api/auth/publisher-login', function (req, res) {
    var body = req.body;
    if (!body.username || !body.password) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '账号和密码不能为空' } });
    }
    var pub = db.authenticatePublisher(body.username, body.password);
    if (!pub) {
      return res.status(403).json({ ok: false, error: { code: 'AUTH_FAILED', message: '账号或密码错误' } });
    }
    if (pub.status !== 'active') {
      return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_DISABLED', message: '该账号已被禁用，请联系管理员' } });
    }
    res.json({ ok: true, data: { id: pub.id, username: pub.username, display_name: pub.display_name } });
  });
};
