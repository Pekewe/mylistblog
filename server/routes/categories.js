// ============================================================
// 分类 API 路由
// 职责：处理分类的查询、新增、删除
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // ---- 前台公开接口 ----

  // 获取所有分类及每个分类下的清单数量
  app.get('/api/categories', function (req, res) {
    var cats = db.getCategories();
    res.json({ ok: true, data: cats });
  });

  // ---- 后台管理接口（需管理员登录）----
  var requireAdmin = require('../middleware/auth').requireAdmin;

  // 新增分类
  app.post('/api/admin/categories', requireAdmin, function (req, res) {
    var name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '分类名称不能为空' } });
    }
    var ok = db.addCategory(name);
    if (!ok) {
      return res.status(409).json({ ok: false, error: { code: 'DUPLICATE', message: '分类已存在' } });
    }
    res.status(201).json({ ok: true });
  });

  // 删除分类
  app.delete('/api/admin/categories/:id', requireAdmin, function (req, res) {
    db.deleteCategory(parseInt(req.params.id));
    res.json({ ok: true });
  });
};
