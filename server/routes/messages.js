// ============================================================
// 留言 API 路由
// 职责：处理留言的提交、审核、回复、删除
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // ---- 前台公开接口 ----

  // 分页获取已审核通过的留言
  app.get('/api/messages', function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 20;
    var result = db.getApprovedMessages(page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 提交新留言（游客无需登录，默认待审核）
  app.post('/api/messages', function (req, res) {
    var body = req.body;
    // 验证必填字段
    if (!body.name || !body.content) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '昵称和内容不能为空' } });
    }
    if (body.name.length > 50) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '昵称不能超过50个字符' } });
    }
    if (body.content.length > 2000) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '内容不能超过2000个字符' } });
    }
    var id = db.addMessage(body);
    res.status(201).json({ ok: true, data: { id: id } });
  });

  // ---- 后台管理接口（需管理员登录）----
  var requireAdmin = require('../middleware/auth').requireAdmin;

  // 分页获取所有留言（含待审核和已拒绝）
  app.get('/api/admin/messages', requireAdmin, function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var size = parseInt(req.query.size) || 100;
    var result = db.getAllMessagesPaged(page, size);
    res.json({ ok: true, data: result.rows, meta: { page: result.page, size: result.size, total: result.total, totalPages: result.totalPages } });
  });

  // 审核留言：修改状态（pending → approved / rejected）
  app.put('/api/admin/messages/:id', requireAdmin, function (req, res) {
    var id = parseInt(req.params.id);
    var status = req.body.status;
    if (!status || ['pending', 'approved', 'rejected'].indexOf(status) === -1) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '状态值无效' } });
    }
    db.updateMessage(id, { status: status });
    res.json({ ok: true });
  });

  // 删除留言
  app.delete('/api/admin/messages/:id', requireAdmin, function (req, res) {
    db.deleteMessage(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // 管理员回复留言
  app.put('/api/admin/messages/:id/reply', requireAdmin, function (req, res) {
    var id = parseInt(req.params.id);
    var replyContent = (req.body.replyContent || '').trim();
    if (!replyContent) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '回复内容不能为空' } });
    }
    if (replyContent.length > 2000) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '回复内容不能超过2000个字符' } });
    }
    db.replyMessage(id, replyContent, req.session.adminUser || '管理员');
    res.json({ ok: true });
  });
};
