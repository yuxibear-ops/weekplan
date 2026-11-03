/* 待办 */
(function () {
  'use strict';
  var App = window.App;

  App.todoFilter = 'all';
  var PRIO = { high: '高', mid: '中', low: '低' };

  function sortTodos(list) {
    var order = { high: 0, mid: 1, low: 2 };
    return list.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      var ad = a.date || '9999', bd = b.date || '9999';
      if (ad !== bd) return ad < bd ? -1 : 1;
      var ap = (a.priority in order) ? order[a.priority] : 3;
      var bp = (b.priority in order) ? order[b.priority] : 3;
      if (ap !== bp) return ap - bp;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function filtered() {
    var list = App.state.todos;
    var f = App.todoFilter;
    if (f === 'today') {
      var t = App.today();
      list = list.filter(function (x) { return x.date === t; });
    } else if (f === 'active') {
      list = list.filter(function (x) { return !x.done; });
    }
    return sortTodos(list);
  }

  App.renderTodos = function () {
    var view = document.getElementById('view-todos');
    var list = filtered();
    var html = '<div class="filter-bar">';
    [['all', '全部'], ['today', '今天'], ['active', '未完成']].forEach(function (f) {
      html += '<button class="filter-btn' + (App.todoFilter === f[0] ? ' active' : '') + '" data-filter="' + f[0] + '">' + f[1] + '</button>';
    });
    html += '</div>';

    if (!list.length) {
      html += '<div class="empty">还没有 ddl,点右上角 ＋ 添加</div>';
    } else {
      html += '<div class="todo-list">';
      list.forEach(function (t) {
        var placedKey = App.findTodoPlacement(t.id);
        html += '<div class="todo-item" data-id="' + t.id + '">'
          + '<button class="todo-check' + (t.done ? ' on' : '') + '" data-act="toggle">' + (t.done ? '✓' : '') + '</button>'
          + '<div class="todo-body" data-act="edit">'
          +   '<div class="todo-text' + (t.done ? ' done' : '') + '">' + App.esc(t.text) + '</div>'
          +   '<div class="todo-meta">'
          +     (t.date ? '<span>' + App.fmtDate(t.date) + '</span>' : '')
          +     (t.priority && PRIO[t.priority] ? '<span class="pri ' + t.priority + '">' + PRIO[t.priority] + '</span>' : '')
          +     (placedKey ? '<span class="placed-tag">在课表</span>' : '')
          +   '</div>'
          + '</div>'
          + (placedKey
              ? '<button class="todo-place" data-act="unplace" title="移出课表">↩</button>'
              : '<button class="todo-place" data-act="place" title="放入课表">⏱</button>')
          + '<button class="todo-del" data-act="del">✕</button>'
          + '</div>';
      });
      html += '</div>';
    }
    view.innerHTML = html;
  };

  App.findTodo = function (id) {
    var r = null;
    App.state.todos.forEach(function (t) { if (t.id === id) r = t; });
    return r;
  };

  App.findTodoPlacement = function (id) {
    var tc = App.state.timetable.todoCells || {};
    for (var k in tc) { if (tc[k] === id) return k; }
    return null;
  };

  App.startPlaceTodo = function (id) {
    App._placingTodoId = id;
    App.switchTab('timetable');
    App.toast('点课表里的空格子,把这个 ddl 放进去');
  };

  App.unplaceTodo = function (id) {
    var tc = App.state.timetable.todoCells || {};
    for (var k in tc) { if (tc[k] === id) delete tc[k]; }
    Store.save(App.state);
    App.renderTodos();
    App.renderTimetable();
    App.toast('已从课表移出');
  };

  function setSeg(containerId, value) {
    var box = document.getElementById(containerId);
    var btns = box.querySelectorAll('.seg-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.p === value);
    }
    box.dataset.value = value;
  }

  App.openTodoEditor = function (id) {
    var t = null;
    if (id) {
      App.state.todos.forEach(function (x) { if (x.id === id) t = x; });
    }
    App._todoId = id || null;
    document.getElementById('todo-text').value = t ? t.text : '';
    document.getElementById('todo-date').value = t ? (t.date || '') : '';
    setSeg('todo-priority', t ? (t.priority || '') : '');
    document.getElementById('todo-delete').style.display = t ? 'block' : 'none';
    App.openModal('modal-todo');
  };

  App.saveTodo = function () {
    var text = document.getElementById('todo-text').value.trim();
    if (!text) { App.toast('内容不能为空'); return; }
    var date = document.getElementById('todo-date').value;
    var priority = document.getElementById('todo-priority').dataset.value || '';
    if (App._todoId) {
      App.state.todos.forEach(function (t) {
        if (t.id === App._todoId) { t.text = text; t.date = date; t.priority = priority; }
      });
    } else {
      App.state.todos.push({
        id: App.uid(), text: text, date: date, priority: priority,
        done: false, createdAt: Date.now()
      });
    }
    Store.save(App.state);
    App.renderTodos();
    App.closeModal('modal-todo');
    App.toast('已保存');
  };

  App.toggleTodo = function (id) {
    App.state.todos.forEach(function (t) { if (t.id === id) t.done = !t.done; });
    Store.save(App.state);
    App.renderTodos();
  };

  App.deleteTodo = function (id) {
    App.state.todos = App.state.todos.filter(function (t) { return t.id !== id; });
    Store.save(App.state);
    App.renderTodos();
  };
})();
