// ============================================================
// 前端共用功能模块
// 职责：站点标题渲染、清单/留言HTML模板、工具函数
// 所有前台页面通过 <script src="common.js"> 引用
// ============================================================

var Common = {
  siteName: '发布清单总站',  // 站点名称（从后端加载后覆盖）
  siteIntro: '',             // 站点简介（从后端加载后覆盖）

  // ---- 初始化 ----
  // 从后端加载站点设置 → 渲染页头和页脚 → 执行页面回调
  init: function (callback) {
    API.getPublicSettings(function (err, res) {
      if (!err && res && res.ok && res.data) {
        if (res.data.site_name) Common.siteName = res.data.site_name;
        if (res.data.site_intro) Common.siteIntro = res.data.site_intro;
      }
      Common.renderHeader();
      Common.renderFooter();
      if (callback) callback();
    });
  },

  // ---- 渲染页头（站点名称 + 简介 + 导航菜单）----
  renderHeader: function () {
    var el = document.getElementById('header');
    if (!el) return;
    el.innerHTML =
      '<div id="web-name"><p>' + Common.escapeHtml(Common.siteName) + '</p></div>' +
      '<div id="web-intro"><p>' + Common.escapeHtml(Common.siteIntro) + '</p></div>' +
      '<div id="menu">' +
      '<table><tr>' +
      '<td><a href="index.html">首页</a></td>' +
      '<td><a href="lt-class.html">分类</a></td>' +
      '<td><a href="lt-search.html">搜索</a></td>' +
      '<td><a href="lt-post.html">发布</a></td>' +
      '<td><a href="lt-bbs.html">留言</a></td>' +
      '<td><a href="lt-about.html">关于</a></td>' +
      '</tr></table>' +
      '</div>';
  },

  // ---- 渲染页脚 ----
  renderFooter: function () {
    var el = document.getElementById('footer');
    if (!el) return;
    el.innerHTML = '<div id="footer"><p>&copy; 2006-' + new Date().getFullYear() + ' ' +
      Common.escapeHtml(Common.siteName) + ' | Powered by vanilla JS + Node.js</p></div>';
  },

  // ---- HTML 转义（防 XSS）----
  escapeHtml: function (str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // ---- 渲染单条清单表格（首页、分类、搜索页共用）----
  // list 对象包含：id, title, product_code, category, author, image, status,
  //                 created_at, items: string[], links: {title, url}[]
  renderListTable: function (list) {
    // 清单内容文本
    var itemsHtml = '';
    if (list.items && list.items.length) {
      for (var i = 0; i < list.items.length; i++) {
        itemsHtml += Common.escapeHtml(list.items[i]) + '\n';
      }
    }
    // 封面图片展示（有图显示图片，无图显示占位框）
    var imageHtml = list.image
      ? '<img src="' + Common.escapeHtml(list.image) + '" alt="清单图片" width="162" height="162">'
      : '<div style="width:162px;height:162px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;margin:0 auto 8px auto;">暂无图片</div>';
    // 相关链接
    var linksHtml = '';
    if (list.links && list.links.length) {
      for (var j = 0; j < list.links.length; j++) {
        linksHtml += '<a href="' + Common.escapeHtml(list.links[j].url) + '" target="_blank">' + Common.escapeHtml(list.links[j].title) + '</a>';
        if (j < list.links.length - 1) linksHtml += '&nbsp;&nbsp;';
      }
    }
    // 状态标签（非已发布状态显示角标）
    var statusBadge = '';
    if (list.status && list.status !== 'published') {
      statusBadge = ' <span style="color:#cc6600;font-size:11px;">[' + list.status + ']</span>';
    }
    return '<table class="info-Table" summary="' + Common.escapeHtml(list.title) + '">' +
      '<tbody>' +
      '<tr class="info-TR">' +
      '<td id="PictureSide">' +
      '<span>' + imageHtml + '</span>' +
      '<div id="infoLink">' + linksHtml + '</div>' +
      '</td>' +
      '<td id="infoSide">' +
      '<span id="infoSpan">' +
      '<p>名稱：' + Common.escapeHtml(list.title) + statusBadge + '</p>' +
      '<p>類別：' + Common.escapeHtml(list.category) + '</p>' +
      '<p>編號：' + list.id + '&nbsp;&nbsp;&nbsp;&nbsp;商品編號：' + Common.escapeHtml(list.product_code || '') + '</p>' +
      '<p>发布：' + Common.escapeHtml(list.author) + ' (' + list.created_at + ')</p>' +
      '</span>' +
      '<textarea id="infoText" rows="5" cols="30" readonly>' + itemsHtml + '</textarea>' +
      '</td>' +
      '</tr>' +
      '</tbody>' +
      '</table>';
  },

  // ---- 渲染单条留言（留言板页面使用）----
  // msg 对象包含：id, name, content, status, created_at,
  //               reply_content, reply_at, reply_by
  renderMessageItem: function (msg) {
    var html = '<div class="message-item">' +
      '<div class="message-header">' +
      '<span class="msg-name">' + Common.escapeHtml(msg.name) + '</span>' +
      (msg.status !== 'approved' ? '<span class="message-pending">[待审核]</span>' : '') +
      '<span class="msg-date">' + msg.created_at + '</span>' +
      '</div>' +
      '<div class="message-body">' +
      Common.escapeHtml(msg.content);

    // 如果有管理员回复，在留言下方显示（缩进 + 不同底色 + 左侧边线）
    if (msg.reply_content) {
      html += '<div class="message-reply">' +
        '<div class="reply-label">管理员回复：</div>' +
        '<div class="reply-text">' + Common.escapeHtml(msg.reply_content) + '</div>' +
        '<div class="reply-meta">' + Common.escapeHtml(msg.reply_by) + ' 于 ' + msg.reply_at + '</div>' +
        '</div>';
    }

    html += '</div></div>';
    return html;
  },

  // ---- 显示临时提示条（3秒后自动消失）----
  // type: 'info' / 'success' / 'error'
  showAlert: function (message, type) {
    type = type || 'info';
    var container = document.getElementById('content');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.textContent = message;
    container.insertBefore(div, container.firstChild);
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 3000);
  },

  // ---- 从 URL 查询参数中获取值 ----
  // 用于分页：index.html?page=2
  getUrlParam: function (name) {
    var url = window.location.search.substring(1);
    var params = url.split('&');
    for (var i = 0; i < params.length; i++) {
      var pair = params[i].split('=');
      if (pair[0] === name) return decodeURIComponent(pair[1] || '');
    }
    return null;
  }
};

// 页面加载后自动初始化
document.addEventListener('DOMContentLoaded', function () {
  Common.init();
});
