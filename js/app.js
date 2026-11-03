/* 入口:初始化 + 事件绑定 + 路由 */
(function () {
  'use strict';
  var App = window.App;

  App.init = function () {
    App.state = Store.load();
    App.renderPalette('course-color', App.PALETTE[0]);
    App.renderPalette('note-color', App.PALETTE[2]);
    App.bindEvents();
    App.switchTab('timetable');
    App.renderSettings();
  };

  App.bindEvents = function () {
    // Tab 切换
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        App.switchTab(this.dataset.tab);
      });
    }

    // 顶部按钮
    document.getElementById('btn-settings').addEventListener('click', function () {
      App.renderSettings();
      App.openModal('modal-settings');
    });
    document.getElementById('btn-add').addEventListener('click', function () {
      if (App.currentTab === 'todos') App.openTodoEditor(null);
      else if (App.currentTab === 'notes') App.openNoteEditor(null);
    });

    // 课程表点击(委托)
    document.getElementById('view-timetable').addEventListener('click', function (e) {
      if (App._suppressClick) { App._suppressClick = false; return; }
      var cell = e.target.closest('.cell');
      if (!cell) return;
      if (App._placingTodoId) {
        var day = cell.dataset.day, pid = cell.dataset.pid;
        var k = App.cellKey(day, pid);
        if (!day || App.isCourseCell(day, pid) || (App.state.timetable.todoCells && App.state.timetable.todoCells[k])) {
          App.toast('这里已经有东西了'); return;
        }
        App.state.timetable.todoCells = App.state.timetable.todoCells || {};
        App.state.timetable.todoCells[k] = App._placingTodoId;
        App._placingTodoId = null;
        Store.save(App.state);
        App.renderTimetable();
        App.renderTodos();
        App.toast('已放入课表');
        return;
      }
      if (cell.dataset.todo) {
        var todoId = cell.dataset.todo;
        if (!App.findTodo(todoId)) {
          var pk = App.findTodoPlacement(todoId);
          if (pk) {
            delete App.state.timetable.todoCells[pk];
            Store.save(App.state);
            App.renderTimetable();
            App.toast('已清除失效的 ddl');
          }
          return;
        }
        App.toggleTodo(todoId);
        return;
      }
      App.openCourseEditor(cell.dataset.day, cell.dataset.pid);
    });

    // 拖拽课程块底部,调整连上节数
    document.getElementById('view-timetable').addEventListener('pointerdown', function (e) {
      var handle = e.target.closest('.drag-handle');
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      var block = handle.closest('.cell.filled');
      var day = block.dataset.day, pid = block.dataset.pid;
      var key = App.cellKey(day, pid);
      var cell = App.state.timetable.cells[key];
      if (!cell) return;
      var times = document.querySelectorAll('#view-timetable .tt-time');
      var periodPx = times.length > 1 ? (times[1].offsetTop - times[0].offsetTop) : 48;
      var maxSpan = App.maxSpanFor(day, pid);
      var startY = e.clientY;
      var origSpan = cell.span || 1;
      var curSpan = origSpan;
      var hint = document.getElementById('drag-hint');
      hint.style.display = 'block';
      hint.textContent = origSpan + ' 节';
      hint.style.left = (e.clientX + 12) + 'px';
      hint.style.top = (e.clientY - 24) + 'px';

      function onMove(ev) {
        ev.preventDefault();
        var ns = origSpan + Math.round((ev.clientY - startY) / periodPx);
        ns = Math.max(1, Math.min(maxSpan, ns));
        if (ns !== curSpan) { curSpan = ns; hint.textContent = ns + ' 节'; }
        hint.style.left = (ev.clientX + 12) + 'px';
        hint.style.top = (ev.clientY - 24) + 'px';
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        hint.style.display = 'none';
        if (curSpan !== origSpan) {
          cell.span = curSpan;
          Store.save(App.state);
          App.renderTimetable();
          App.toast('已改为 ' + curSpan + ' 节');
        }
        App._suppressClick = true;
        setTimeout(function () { App._suppressClick = false; }, 100);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    // 待办(委托)
    document.getElementById('view-todos').addEventListener('click', function (e) {
      var fb = e.target.closest('.filter-btn');
      if (fb) { App.todoFilter = fb.dataset.filter; App.renderTodos(); return; }
      var item = e.target.closest('.todo-item');
      if (!item) return;
      var id = item.dataset.id;
      var actEl = e.target.closest('[data-act]');
      var act = actEl ? actEl.dataset.act : 'edit';
      if (act === 'toggle') App.toggleTodo(id);
      else if (act === 'del') App.deleteTodo(id);
      else if (act === 'place') App.startPlaceTodo(id);
      else if (act === 'unplace') App.unplaceTodo(id);
      else App.openTodoEditor(id);
    });

    // 便签(委托)
    document.getElementById('view-notes').addEventListener('click', function (e) {
      var card = e.target.closest('.note-card');
      if (!card) return;
      var id = card.dataset.id;
      var actEl = e.target.closest('[data-act]');
      var act = actEl ? actEl.dataset.act : 'edit';
      if (act === 'del') {
        App.confirm('删除这张便签?', function () { App.deleteNote(id); });
      } else if (act === 'pin') {
        App.togglePin(id);
      } else {
        App.openNoteEditor(id);
      }
    });

    // 便签搜索
    document.getElementById('view-notes').addEventListener('input', function (e) {
      if (e.target.id === 'note-search') {
        App.noteQuery = e.target.value;
        App.renderNotes();
        var el = document.getElementById('note-search');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }
    });

    // 课程保存/删除
    document.getElementById('course-save').addEventListener('click', App.saveCourse);
    document.getElementById('course-delete').addEventListener('click', function () {
      App.confirm('删除这门课?', App.deleteCourse);
    });

    // 待办保存/删除
    document.getElementById('todo-save').addEventListener('click', App.saveTodo);
    document.getElementById('todo-delete').addEventListener('click', function () {
      if (App._todoId) { App.deleteTodo(App._todoId); App.closeModal('modal-todo'); App.toast('已删除'); }
    });

    // 便签保存/删除
    document.getElementById('note-save').addEventListener('click', App.saveNote);
    document.getElementById('note-delete').addEventListener('click', function () {
      if (App._noteId) { App.deleteNote(App._noteId); App.closeModal('modal-note'); App.toast('已删除'); }
    });

    // 优先级分段按钮
    document.getElementById('todo-priority').addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-btn');
      if (!btn) return;
      var btns = this.querySelectorAll('.seg-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
      btn.classList.add('active');
      this.dataset.value = btn.dataset.p;
    });

    // 设置:显示周末
    document.getElementById('show-weekend').addEventListener('change', function () {
      App.state.timetable.showWeekend = this.checked;
      Store.save(App.state);
      App.renderTimetable();
    });

    // 设置:添加一节
    document.getElementById('period-add').addEventListener('click', function () {
      var ps = App.state.timetable.periods;
      var n = ps.length + 1;
      ps.push({ id: 'p' + n, label: '第' + n + '节', time: '' });
      Store.save(App.state);
      App.renderSettings();
      App.renderTimetable();
    });

    // 设置:节次编辑(委托)
    document.getElementById('periods-list').addEventListener('input', function (e) {
      var row = e.target.closest('.period-row');
      if (!row) return;
      var id = row.dataset.id;
      App.state.timetable.periods.forEach(function (p) {
        if (p.id === id) {
          if (e.target.dataset.key === 'label') p.label = e.target.value;
          if (e.target.dataset.key === 'time') p.time = e.target.value;
        }
      });
      Store.save(App.state);
      App.renderTimetable();
    });
    document.getElementById('periods-list').addEventListener('click', function (e) {
      var del = e.target.closest('[data-act="del-period"]');
      if (!del) return;
      var id = del.closest('.period-row').dataset.id;
      App.state.timetable.periods = App.state.timetable.periods.filter(function (p) { return p.id !== id; });
      App.DAYS.forEach(function (d) { delete App.state.timetable.cells[App.cellKey(d, id)]; });
      Store.save(App.state);
      App.renderSettings();
      App.renderTimetable();
    });

    // 设置:导出/导入/清空
    document.getElementById('btn-export').addEventListener('click', App.exportJSON);
    document.getElementById('btn-import').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (file) App.importJSON(file);
      this.value = '';
    });
    document.getElementById('btn-clear').addEventListener('click', App.clearAll);

    // 确认框
    document.getElementById('confirm-ok').addEventListener('click', function () {
      App.closeModal('modal-confirm');
      if (App._confirmOk) App._confirmOk();
    });

    // backdrop 与 data-close 关闭
    var backs = document.querySelectorAll('.modal-backdrop');
    for (var b = 0; b < backs.length; b++) {
      backs[b].addEventListener('click', function () {
        App.closeModal(this.dataset.close);
      });
    }
    var closers = document.querySelectorAll('[data-close]');
    for (var c = 0; c < closers.length; c++) {
      if (closers[c].classList.contains('modal-backdrop')) continue;
      closers[c].addEventListener('click', function () {
        App.closeModal(this.dataset.close);
      });
    }
  };

  App.switchTab = function (tab) {
    App.currentTab = tab;
    if (tab !== 'timetable') App._placingTodoId = null;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.tab === tab);
    var views = document.querySelectorAll('.view');
    for (var j = 0; j < views.length; j++) views[j].classList.toggle('active', views[j].id === 'view-' + tab);
    var titles = { timetable: 'WEEK♕', todos: 'ddl', notes: '便签' };
    document.getElementById('view-title').textContent = titles[tab];
    document.getElementById('btn-add').style.display = (tab === 'timetable') ? 'none' : 'flex';
    if (tab === 'timetable') App.renderTimetable();
    if (tab === 'todos') App.renderTodos();
    if (tab === 'notes') App.renderNotes();
  };

  App.renderSettings = function () {
    var tt = App.state.timetable;
    var list = document.getElementById('periods-list');
    var html = '';
    tt.periods.forEach(function (p) {
      html += '<div class="period-row" data-id="' + App.esc(p.id) + '">'
        + '<input class="period-label" data-key="label" value="' + App.esc(p.label) + '">'
        + '<input class="period-time" data-key="time" value="' + App.esc(p.time || '') + '" placeholder="时间">'
        + '<button class="period-del" data-act="del-period">✕</button>'
        + '</div>';
    });
    list.innerHTML = html;
    document.getElementById('show-weekend').checked = !!tt.showWeekend;
  };

  App.exportJSON = function () {
    var blob = new Blob([Store.exportJSON(App.state)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '课程表备份.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    App.toast('已导出');
  };

  App.importJSON = function (file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = Store.parseJSON(reader.result);
        App.state = Store.normalize(obj);
        Store.save(App.state);
        App.renderSettings();
        App.renderTimetable();
        App.renderTodos();
        App.renderNotes();
        App.toast('导入成功');
      } catch (e) {
        App.toast('导入失败:' + e.message);
      }
    };
    reader.readAsText(file);
  };

  App.clearAll = function () {
    App.confirm('确定清空所有课程、待办和便签吗?此操作无法撤销。', function () {
      App.state = Store.defaultState();
      Store.save(App.state);
      App.renderSettings();
      App.renderTimetable();
      App.renderTodos();
      App.renderNotes();
      App.toast('已清空');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
})();
