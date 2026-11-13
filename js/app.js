/* 入口:初始化 + 事件绑定 + 路由 */
(function () {
  'use strict';
  var App = window.App;

  App.init = function () {
    App.state = Store.load();
    App._undoStack = [];
    App._redoStack = [];
    App.migrateTodoCells();
    App.autoCleanDoneTodos();
    App.renderPalette('course-color', App.PALETTE[0]);
    App.renderPalette('note-color', App.PALETTE[2]);
    App.bindEvents();
    App.switchTab('timetable');
    App.renderSettings();
    App.applyBackground();
    App.applyCellOpacity();
    App.updateSemesterBtn();
    App.updateTabLabels();
    App.updateUndoBtn();
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
      var wb = e.target.closest('.week-btn');
      if (wb) {
        var d = parseInt(wb.dataset.week, 10);
        App.state.currentWeek = Math.max(1, Math.min(30, (App.state.currentWeek || 1) + d));
        Store.save(App.state);
        App.renderTimetable();
        return;
      }
      var cell = e.target.closest('.cell');
      if (!cell) return;
      if (App._movingCourse) {
        var mc = App._movingCourse;
        var mvDay = cell.dataset.day, mvPid = cell.dataset.pid;
        if (!mvDay || !mvPid) { App._movingCourse = null; App.renderTimetable(); return; }
        var mvKey = App.cellKey(mvDay, mvPid);
        if (App.state.timetable.cells[mvKey] || App.cellHasActiveDdl(mvDay, mvPid)) {
          App.toast('这里不是空的'); return;
        }
        var srcKey = App.cellKey(mc.day, mc.pid);
        var course = App.state.timetable.cells[srcKey];
        if (!course) { App._movingCourse = null; App.renderTimetable(); return; }
        var mIdx = -1;
        App.state.timetable.periods.forEach(function (pp, i) { if (pp.id === mvPid) mIdx = i; });
        for (var m2 = 1; m2 < (course.span || 1); m2++) {
          var npp = App.state.timetable.periods[mIdx + m2];
          if (npp && (App.state.timetable.cells[App.cellKey(mvDay, npp.id)] || App.cellHasActiveDdl(mvDay, npp.id))) {
            App.toast('目标位置放不下(会覆盖别的课)'); return;
          }
        }
        App.captureUndo();
        App.state.timetable.cells[mvKey] = course;
        delete App.state.timetable.cells[srcKey];
        for (var m3 = 1; m3 < (course.span || 1); m3++) {
          var npp3 = App.state.timetable.periods[mIdx + m3];
          if (npp3) delete App.state.timetable.cells[App.cellKey(mvDay, npp3.id)];
        }
        App._movingCourse = null;
        Store.save(App.state);
        App.renderTimetable();
        App.updateUndoBtn();
        App.toast('已移动');
        return;
      }
      if (App._placingTodoId) {
        var day = cell.dataset.day, pid = cell.dataset.pid;
        var k = App.cellKey(day, pid);
        if (!day || App.isCourseCell(day, pid) || App.cellHasActiveDdl(day, pid)) {
          App.toast('这里已经有东西了'); return;
        }
        App.captureUndo();
        App.state.timetable.todoCells = App.state.timetable.todoCells || {};
        var pt = App.findTodo(App._placingTodoId);
        var _dates = App.weekDates();
        var _dayDate = App.dateStr(_dates[App.DAYS.indexOf(day)]);
        App.state.timetable.todoCells[_dayDate + '|' + pid] = { id: App._placingTodoId, text: pt ? pt.text : '', done: pt ? !!pt.done : false, date: _dayDate };
        App._placingTodoId = null;
        Store.save(App.state);
        App.renderTimetable();
        App.renderTodos();
        App.toast('已放入课表');
        return;
      }
      if (cell.dataset.todo) {
        App.toggleTodo(cell.dataset.todo);
        return;
      }
      if (cell.dataset.day && cell.dataset.pid) {
        var cKey = App.cellKey(cell.dataset.day, cell.dataset.pid);
        if (App.state.timetable.cells[cKey]) {
          var now = Date.now();
          if (App._lastTap && App._lastTap.key === cKey && (now - App._lastTap.time) < 320) {
            clearTimeout(App._lastTap.timer);
            App._lastTap = null;
            App._movingCourse = { day: cell.dataset.day, pid: cell.dataset.pid };
            App.renderTimetable();
            App.toast('已选中,点一个空格子移动');
            return;
          }
          if (App._lastTap) clearTimeout(App._lastTap.timer);
          var tmr = setTimeout(function () {
            App._lastTap = null;
            App.openCourseEditor(cell.dataset.day, cell.dataset.pid);
          }, 320);
          App._lastTap = { key: cKey, time: now, timer: tmr };
          return;
        }
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

    // (移动方式已改为双击选中)

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
      }
    });

    // 课程保存/删除
    document.getElementById('course-save').addEventListener('click', App.saveCourse);
    document.getElementById('course-delete').addEventListener('click', function () {
      App.confirm('删除这门课?', App.deleteCourse);
    });
    document.getElementById('course-delete-week').addEventListener('click', function () {
      App.confirm('只删除本周的这门课?', App.deleteCourseWeek);
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

    // 设置:背景
    document.getElementById('btn-bg').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (file) App.setBackgroundImage(file);
      this.value = '';
    });
    document.getElementById('btn-bg-clear').addEventListener('click', App.clearBackground);
    document.getElementById('bg-opacity').addEventListener('input', function () {
      App.setBackgroundOpacity(parseInt(this.value, 10));
    });
    document.getElementById('cell-opacity').addEventListener('input', function () {
      App.setCellOpacity(parseInt(this.value, 10));
      document.getElementById('cell-opacity-val').textContent = this.value + '%';
    });

    // 设置:自定义
    document.getElementById('app-name').addEventListener('input', function () {
      App.state.appName = this.value;
      Store.save(App.state);
      App.updateTabLabels();
      if (App.currentTab === 'timetable') {
        document.getElementById('view-title').textContent = this.value || 'WEEK♕';
      }
    });
    document.getElementById('todos-name').addEventListener('input', function () {
      App.state.todosName = this.value;
      Store.save(App.state);
      App.updateTabLabels();
      if (App.currentTab === 'todos') document.getElementById('view-title').textContent = this.value || 'ddl';
    });
    document.getElementById('notes-name').addEventListener('input', function () {
      App.state.notesName = this.value;
      Store.save(App.state);
      App.updateTabLabels();
      if (App.currentTab === 'notes') document.getElementById('view-title').textContent = this.value || '便签';
    });
    document.getElementById('auto-clean').addEventListener('change', function () {
      App.state.autoCleanDone = this.checked;
      Store.save(App.state);
    });
    document.getElementById('semester-start').addEventListener('change', function () {
      App.state.semesterStart = this.value;
      Store.save(App.state);
      App.renderTimetable();
    });
    document.getElementById('place-emoji').addEventListener('input', function () {
      App.state.placeEmoji = this.value;
      Store.save(App.state);
      App.renderTodos();
    });
    document.getElementById('unplace-emoji').addEventListener('input', function () {
      App.state.unplaceEmoji = this.value;
      Store.save(App.state);
      App.renderTodos();
    });

    // 本周 + 学期
    document.getElementById('btn-this-week').addEventListener('click', App.goThisWeek);
    document.getElementById('btn-undo').addEventListener('click', App.undo);
    document.getElementById('btn-redo').addEventListener('click', App.redo);
    document.getElementById('btn-semester').addEventListener('click', function () {
      App.renderSemesters();
      App.openModal('modal-semester');
    });
    document.getElementById('semester-list').addEventListener('click', function (e) {
      var item = e.target.closest('.semester-item');
      if (item) App.switchSemester(item.dataset.id);
    });
    document.getElementById('new-sem-add').addEventListener('click', App.createSemester);

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
    if (tab !== 'timetable') { App._placingTodoId = null; App._movingCourse = null; }
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.tab === tab);
    var views = document.querySelectorAll('.view');
    for (var j = 0; j < views.length; j++) views[j].classList.toggle('active', views[j].id === 'view-' + tab);
    var titles = { timetable: (App.state.appName || 'WEEK♕'), todos: (App.state.todosName || 'ddl'), notes: (App.state.notesName || '便签') };
    document.getElementById('view-title').textContent = titles[tab];
    document.getElementById('btn-add').style.display = (tab === 'timetable') ? 'none' : 'flex';
    document.getElementById('btn-this-week').style.display = (tab === 'timetable') ? 'flex' : 'none';
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
    var op = Math.round((App.state.backgroundOpacity || 1) * 100);
    document.getElementById('bg-opacity').value = op;
    document.getElementById('bg-opacity-val').textContent = op + '%';
    var cop = Math.round((App.state.cellOpacity || 0.55) * 100);
    document.getElementById('cell-opacity').value = cop;
    document.getElementById('cell-opacity-val').textContent = cop + '%';
    document.getElementById('app-name').value = App.state.appName || 'WEEK♕';
    document.getElementById('todos-name').value = App.state.todosName || 'ddl';
    document.getElementById('notes-name').value = App.state.notesName || '便签';
    document.getElementById('semester-start').value = App.state.semesterStart || '2026-09-07';
    document.getElementById('place-emoji').value = App.state.placeEmoji || '⏱';
    document.getElementById('unplace-emoji').value = App.state.unplaceEmoji || '↩';
    document.getElementById('auto-clean').checked = !!App.state.autoCleanDone;
  };

  App.applyBackground = function () {
    var layer = document.getElementById('bg-layer');
    if (!layer) return;
    var bg = App.state.background || '';
    document.body.classList.toggle('has-bg', !!bg);
    if (bg) {
      layer.style.backgroundImage = 'url(' + bg + ')';
      layer.style.opacity = (typeof App.state.backgroundOpacity === 'number') ? App.state.backgroundOpacity : 1;
      layer.style.display = 'block';
    } else {
      layer.style.display = 'none';
    }
  };

  App.applyCellOpacity = function () {
    var a = (typeof App.state.cellOpacity === 'number') ? App.state.cellOpacity : 0.55;
    document.documentElement.style.setProperty('--cell-alpha', a);
  };

  App.setCellOpacity = function (val) {
    App.state.cellOpacity = val / 100;
    Store.save(App.state);
    App.applyCellOpacity();
    App.renderTimetable();
  };

  App.setBackgroundImage = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        App.state.background = canvas.toDataURL('image/jpeg', 0.78);
        Store.save(App.state);
        App.applyBackground();
        App.toast('背景已设置');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  App.clearBackground = function () {
    App.state.background = '';
    Store.save(App.state);
    App.applyBackground();
    App.toast('背景已清除');
  };

  App.setBackgroundOpacity = function (val) {
    App.state.backgroundOpacity = val / 100;
    Store.save(App.state);
    App.applyBackground();
    document.getElementById('bg-opacity-val').textContent = val + '%';
  };

  App.goThisWeek = function () {
    var start = new Date((App.state.semesterStart || '2026-09-07') + 'T00:00:00');
    var today = new Date(App.today() + 'T00:00:00');
    var diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
    var week = Math.max(1, Math.floor(diff / 7) + 1);
    App.state.currentWeek = week;
    Store.save(App.state);
    App.renderTimetable();
    App.toast('已回到本周(第 ' + week + ' 周)');
  };

  App.updateSemesterBtn = function () {
    var sem = App.state.semesters[App.state.currentSemesterId];
    document.getElementById('btn-semester').textContent = sem ? sem.name : '2026-2027-1';
  };

  App.switchSemester = function (id) {
    if (id === App.state.currentSemesterId) { App.closeModal('modal-semester'); return; }
    Store.save(App.state);
    App.state.currentSemesterId = id;
    var sem = App.state.semesters[id];
    App.state.timetable = sem.timetable;
    App.state.todos = sem.todos;
    App.state.notes = sem.notes;
    App.state.semesterStart = sem.semesterStart;
    App.state.currentWeek = 1;
    Store.save(App.state);
    App.renderSettings();
    App.renderTimetable();
    App.renderTodos();
    App.renderNotes();
    App.updateSemesterBtn();
    App.closeModal('modal-semester');
    App.toast('已切换到 ' + sem.name);
  };

  App.createSemester = function () {
    var name = document.getElementById('new-sem-name').value.trim();
    if (!name) { App.toast('请输入学期名称'); return; }
    var start = document.getElementById('new-sem-start').value || '2026-09-07';
    App.state.semesters[name] = {
      id: name, name: name, semesterStart: start,
      timetable: { periods: Store.defaultPeriods(), showWeekend: false, cells: {}, todoCells: {} },
      todos: [], notes: []
    };
    Store.save(App.state);
    App.renderSemesters();
    document.getElementById('new-sem-name').value = '';
    App.toast('已创建学期 ' + name + ',点它切换');
  };

  App.snapshot = function () {
    return {
      cells: JSON.parse(JSON.stringify(App.state.timetable.cells)),
      todos: JSON.parse(JSON.stringify(App.state.todos)),
      notes: JSON.parse(JSON.stringify(App.state.notes))
    };
  };

  App.captureUndo = function () {
    App._undoStack.push(App.snapshot());
    if (App._undoStack.length > 50) App._undoStack.shift();
    App._redoStack = [];
    App.updateUndoBtn();
  };

  App.restoreSnapshot = function (snap) {
    App.state.timetable.cells = snap.cells;
    App.state.todos = snap.todos;
    App.state.notes = snap.notes;
  };

  App.renderAll = function () {
    App.renderTimetable();
    App.renderTodos();
    App.renderNotes();
  };

  App.undo = function () {
    if (!App._undoStack.length) { App.toast('没有可撤回的操作'); return; }
    App._redoStack.push(App.snapshot());
    App.restoreSnapshot(App._undoStack.pop());
    Store.save(App.state);
    App.renderAll();
    App.updateUndoBtn();
    App.toast('已撤回');
  };

  App.redo = function () {
    if (!App._redoStack.length) { App.toast('没有可恢复的操作'); return; }
    App._undoStack.push(App.snapshot());
    App.restoreSnapshot(App._redoStack.pop());
    Store.save(App.state);
    App.renderAll();
    App.updateUndoBtn();
    App.toast('已恢复');
  };

  App.updateUndoBtn = function () {
    var ub = document.getElementById('btn-undo');
    var rb = document.getElementById('btn-redo');
    if (ub) ub.style.opacity = App._undoStack.length ? '1' : '0.4';
    if (rb) rb.style.opacity = App._redoStack.length ? '1' : '0.4';
  };

  App.updateTabLabels = function () {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i].dataset.tab;
      if (t === 'timetable') tabs[i].textContent = App.state.appName || 'WEEK♕';
      else if (t === 'todos') tabs[i].textContent = App.state.todosName || 'ddl';
      else if (t === 'notes') tabs[i].textContent = App.state.notesName || '便签';
    }
  };

  App.renderSemesters = function () {
    var box = document.getElementById('semester-list');
    var html = '';
    for (var k in App.state.semesters) {
      var sm = App.state.semesters[k];
      var cur = (k === App.state.currentSemesterId);
      html += '<div class="semester-item' + (cur ? ' current' : '') + '" data-id="' + App.esc(k) + '">'
        + '<span class="semester-name">' + App.esc(sm.name) + (cur ? ' (当前)' : '') + '</span>'
        + '<span class="semester-start">' + App.esc(sm.semesterStart) + ' 起</span>'
        + '</div>';
    }
    box.innerHTML = html;
  };

  App.migrateTodoCells = function () {
    var tc = App.state.timetable.todoCells || {};
    var changed = false;
    for (var k in tc) {
      var v = tc[k];
      if (typeof v === 'string') {
        var t = App.findTodo(v);
        v = { id: v, text: t ? t.text : '(已删除)', done: t ? !!t.done : false };
        tc[k] = v;
        changed = true;
      }
      var parts = k.split('|');
      if (parts.length === 2 && App.DAYS.indexOf(parts[0]) >= 0 && v.date) {
        var nk = v.date + '|' + parts[1];
        if (!tc[nk]) { tc[nk] = v; delete tc[k]; changed = true; }
      }
    }
    if (changed) Store.save(App.state);
  };

  App.autoCleanDoneTodos = function () {
    if (!App.state.autoCleanDone) return;
    var now = Date.now();
    var month = 30 * 86400000;
    var before = App.state.todos.length;
    App.state.todos = App.state.todos.filter(function (t) {
      if (t.done && t.doneAt && (now - t.doneAt) > month) return false;
      return true;
    });
    if (App.state.todos.length !== before) Store.save(App.state);
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
        var tt = null;
        if (obj.semesters && obj.currentSemesterId && obj.semesters[obj.currentSemesterId]) {
          tt = obj.semesters[obj.currentSemesterId].timetable;
        } else if (obj.timetable && typeof obj.timetable === 'object') {
          tt = obj.timetable;
        }
        if (!tt) { App.toast('导入失败:没找到课表数据'); return; }
        App.state.timetable.periods = (Array.isArray(tt.periods) && tt.periods.length) ? tt.periods : App.state.timetable.periods;
        App.state.timetable.showWeekend = !!tt.showWeekend;
        App.state.timetable.cells = (tt.cells && typeof tt.cells === 'object' && !Array.isArray(tt.cells)) ? tt.cells : {};
        Store.save(App.state);
        App.renderSettings();
        App.renderTimetable();
        App.renderTodos();
        App.renderNotes();
        App.toast('课表已导入(ddl 和便签保留)');
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
