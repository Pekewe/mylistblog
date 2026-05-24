// ============================================================
// 认证 API 路由
// 职责：处理管理员登录、登出、身份校验
// 注意：发布人验证在 publishers.js 中
// ============================================================
var db = require('../db/database');

module.exports = function (app) {
  // 管理员登录
  // 成功后创建 session，后续请求通过 Cookie 维持登录状态
  app.post('/api/auth/login', function (req, res) {
    var user = db.authenticate(req.body.username, req.body.password);
    if (user) {
      req.session.adminId = user.id;
      req.session.adminUser = user.username;
      res.json({ ok: true, data: { username: user.username } });
    } else {
      res.status(401).json({
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
      });
    }
  });

  // 管理员退出登录（销毁 session）
  app.post('/api/auth/logout', function (req, res) {
    req.session.destroy();
    res.json({ ok: true });
  });

  // 检查当前管理员登录状态
  app.get('/api/auth/me', function (req, res) {
    if (req.session && req.session.adminId) {
      res.json({ ok: true, data: { username: req.session.adminUser } });
    } else {
      res.json({ ok: true, data: null }); // 未登录
    }
  });
};
