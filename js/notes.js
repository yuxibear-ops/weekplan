/* 便签 */
(function () {
  'use strict';
  var App = window.App;

  App.noteQuery = '';

  function sortedNotes() {
    var q = App.noteQuery.trim().toLowerCase();
    var list = App.state.notes.slice();
    if (q) {
      list = list.filter(function (n) {
        return (n.title || '').toLowerCase().indexOf(q) !== -1 || (n.body || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return list.sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  App.renderNotes = function () {
    var view = document.getElementById('view-notes');
    var list = sortedNotes();
    var html = '<input class="note-search" id="note-search" type="search" placeholder="搜索便签..." value="' + App.esc(App.noteQuery) + '">';
    if (!list.length) {
      html += '<div class="empty">还没有便签,点右上角 ＋ 添加</div>';
    } else {
      html += '<div class="notes-list">';
      list.forEach(function (n) {
        html += '<div class="note-card" style="border-left-color:' + App.esc(n.color || App.PALETTE[2]) + '" data-id="' + n.id + '">'
          + (n.pinned ? '<span class="note-pin">📌</span>' : '')
          + '<div class="note-title">' + App.esc(n.title || '无标题') + '</div>'
          + (n.body ? '<div class="note-body">' + App.esc(n.body) + '</div>' : '')
          + '<div class="note-foot">'
          +   '<span class="note-time">' + App.fmtTime(n.updatedAt) + '</span>'
          +   '<span class="note-acts">'
          +     '<button data-act="pin">' + (n.pinned ? '取消置顶' : '置顶') + '</button>'
          +     '<button data-act="del">删除</button>'
          +   '</span>'
          + '</div>'
          + '</div>';
      });
      html += '</div>';
    }
    view.innerHTML = html;
  };

  App.openNoteEditor = function (id) {
    var n = null;
    if (id) {
      App.state.notes.forEach(function (x) { if (x.id === id) n = x; });
    }
    App._noteId = id || null;
    document.getElementById('note-title').value = n ? (n.title || '') : '';
    document.getElementById('note-body').value = n ? (n.body || '') : '';
    App.renderPalette('note-color', n ? (n.color || App.PALETTE[2]) : App.PALETTE[2]);
    document.getElementById('note-delete').style.display = n ? 'block' : 'none';
    App.openModal('modal-note');
  };

  App.saveNote = function () {
    App.captureUndo();
    var title = document.getElementById('note-title').value.trim();
    var body = document.getElementById('note-body').value.trim();
    if (!title && !body) { App.toast('内容不能为空'); return; }
    var color = document.getElementById('note-color').dataset.value;
    if (App._noteId) {
      App.state.notes.forEach(function (n) {
        if (n.id === App._noteId) { n.title = title; n.body = body; n.color = color; n.updatedAt = Date.now(); }
      });
    } else {
      App.state.notes.push({
        id: App.uid(), title: title, body: body, color: color,
        pinned: false, createdAt: Date.now(), updatedAt: Date.now()
      });
    }
    Store.save(App.state);
    App.renderNotes();
    App.closeModal('modal-note');
    App.toast('已保存');
  };

  App.deleteNote = function (id) {
    App.captureUndo();
    App.state.notes = App.state.notes.filter(function (n) { return n.id !== id; });
    Store.save(App.state);
    App.renderNotes();
  };

  App.togglePin = function (id) {
    App.captureUndo();
    App.state.notes.forEach(function (n) { if (n.id === id) n.pinned = !n.pinned; });
    Store.save(App.state);
    App.renderNotes();
  };
})();
