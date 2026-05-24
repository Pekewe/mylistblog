// ============================================================
// 站点设置 API 路由
// 职责：处理站点设置、管理员密码修改
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // ---- 前台公开接口 ----

  // 获取公开设置（仅站点名称和简介，不暴露敏感设置）
  app.get('/api/settings/public', function (req, res) {
    var settings = db.getPublicSettings();
    res.json({ ok: true, data: settings });
  });

  // ---- 后台管理接口（需管理员登录）----
  var requireAdmin = require('../middleware/auth').requireAdmin;

  // 获取全部设置
  app.get('/api/admin/settings', requireAdmin, function (req, res) {
    var settings = db.getSettings();
    res.json({ ok: true, data: settings });
  });

  // 保存设置
  app.put('/api/admin/settings', requireAdmin, function (req, res) {
    db.saveSettings(req.body);
    res.json({ ok: true });
  });

  // 修改管理员密码
  app.put('/api/admin/password', requireAdmin, function (req, res) {
    var newPass = req.body.password;
    if (!newPass || newPass.length < 4) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '密码至少4个字符' } });
    }
    db.updatePassword(req.session.adminId, newPass);
    res.json({ ok: true });
  });
};
