// ============================================================
// 认证中间件
// 职责：检查请求是否携带有效的管理员 session
// 用法：在需要管理员权限的路由前调用 requireAdmin
// ============================================================

module.exports = {
  // 如果未登录，返回 401 错误
  requireAdmin: function (req, res, next) {
    if (req.session && req.session.adminId) {
      return next(); // 已登录，继续处理请求
    }
    res.status(401).json({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: '请先登录' }
    });
  }
};
