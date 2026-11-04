/* 课程表 */
(function () {
  'use strict';
  var App = window.App;

  function visibleDays() {
    var tt = App.state.timetable;
    return App.DAYS.filter(function (d) {
      if (tt.showWeekend) return true;
      return d !== '周六' && d !== '周日';
    });
  }

  // 返回 { 被覆盖的key -> 主课程key } 的映射
  function buildCover(tt) {
    var cover = {};
    tt.periods.forEach(function (p, idx) {
      App.DAYS.forEach(function (d) {
        var key = App.cellKey(d, p.id);
        var cell = tt.cells[key];
        if (cell && cell.span > 1) {
          for (var k = 1; k < cell.span; k++) {
            var next = tt.periods[idx + k];
            if (next) cover[App.cellKey(d, next.id)] = key;
          }
        }
      });
    });
    return cover;
  }

  App.isCourseCell = function (day, periodId) {
    var tt = App.state.timetable;
    var key = App.cellKey(day, periodId);
    if (tt.cells[key]) return true;
    var idx = -1;
    tt.periods.forEach(function (p, i) { if (p.id === periodId) idx = i; });
    if (idx < 0) return false;
    for (var k = idx - 1; k >= 0; k--) {
      var c = tt.cells[App.cellKey(day, tt.periods[k].id)];
      if (c && c.span > 1 && (idx - k) < c.span) return true;
    }
    return false;
  };

  App.maxSpanFor = function (day, periodId) {
    var tt = App.state.timetable;
    var idx = -1;
    tt.periods.forEach(function (p, i) { if (p.id === periodId) idx = i; });
    if (idx < 0) return 1;
    var max = 1;
    for (var k = idx + 1; k < tt.periods.length; k++) {
      var key = App.cellKey(day, tt.periods[k].id);
      if (tt.cells[key] || (tt.todoCells && tt.todoCells[key])) break;
      max++;
    }
    return max;
  };

  App.renderTimetable = function () {
    var view = document.getElementById('view-timetable');
    var tt = App.state.timetable;
    var days = visibleDays();
    var cover = buildCover(tt);

    var html = '<div class="week-nav">'
      + '<button class="week-btn" data-week="-1">◀</button>'
      + '<span class="week-label">第 ' + (App.state.currentWeek || 1) + ' 周</span>'
      + '<button class="week-btn" data-week="1">▶</button>'
      + '</div>';
    html += '<div class="tt-scroll"><div class="tt-grid" style="--cols:' + days.length + '">';

    // 表头(带日期)
    var dates = App.weekDates();
    var todayStr = App.today();
    html += '<div class="tt-corner" style="grid-column:1;grid-row:1"></div>';
    days.forEach(function (d, di) {
      var idx = App.DAYS.indexOf(d);
      var date = dates[idx];
      var ds = App.dateStr(date);
      var isToday = (ds === todayStr);
      var dayDdls = App.state.todos.filter(function (t) { return t.date === ds && !t.done; });
      html += '<div class="tt-day' + (isToday ? ' today' : '') + '" style="grid-column:' + (di + 2) + ';grid-row:1">'
        + '<span class="tt-dayname">' + App.esc(d) + '</span>'
        + '<span class="tt-date">' + App.fmtShortDate(date) + '</span>'
        + (dayDdls.length ? '<div class="tt-day-ddls">' + dayDdls.map(function (t) { return '<span class="tt-ddl-chip">' + App.esc(t.text) + '</span>'; }).join('') + '</div>' : '')
        + '</div>';
    });

    tt.periods.forEach(function (p, pi) {
      var row = pi + 2;
      html += '<div class="tt-time" style="grid-column:1;grid-row:' + row + '">' + App.esc(p.label) + (p.time ? '<small>' + App.esc(p.time) + '</small>' : '') + '</div>';

      days.forEach(function (d, di) {
        var col = di + 2;
        var key = App.cellKey(d, p.id);
        var cell = tt.cells[key];
        var placement = (tt.todoCells && tt.todoCells[key]) ? tt.todoCells[key] : null;
        var dayDate = App.dateStr(dates[App.DAYS.indexOf(d)]);
        var showPlacement = placement && (typeof placement === 'string' ? true : (!placement.date || placement.date === dayDate));
        if (cell) {
          var span = Math.max(1, cell.span || 1);
          var isMoving = App._movingCourse && App._movingCourse.day === d && App._movingCourse.pid === p.id;
          html += '<button class="cell filled' + (isMoving ? ' moving' : '') + '" style="background:' + App.hexToRgba(cell.color || App.PALETTE[0], (typeof App.state.cellOpacity === 'number' ? App.state.cellOpacity : 0.55)) + ';grid-column:' + col + ';grid-row:' + row + ' / span ' + span + '" data-day="' + App.esc(d) + '" data-pid="' + App.esc(p.id) + '">'
            + '<span class="cname">' + App.esc(cell.name) + '</span>'
            + (cell.location ? '<span class="cloc">' + App.esc(cell.location) + '</span>' : '')
            + '<span class="drag-handle"></span>'
            + '</button>';
        } else if (showPlacement) {
          var done, text, tid;
          if (typeof placement === 'string') {
            tid = placement;
            var todo = App.findTodo(placement);
            done = todo ? !!todo.done : false;
            text = todo ? todo.text : '(已删除)';
          } else {
            tid = placement.id;
            done = !!placement.done;
            text = placement.text || '(已删除)';
          }
          html += '<button class="cell todo-block' + (done ? ' done' : '') + '" style="grid-column:' + col + ';grid-row:' + row + '" data-todo="' + App.esc(tid) + '">'
            + '<span class="todo-mark">' + (done ? '☑' : '☐') + '</span>'
            + '<span class="cname">' + App.esc(text) + '</span>'
            + '</button>';
        } else if (!cover[key]) {
          html += '<button class="cell empty" style="grid-column:' + col + ';grid-row:' + row + '" data-day="' + App.esc(d) + '" data-pid="' + App.esc(p.id) + '">＋</button>';
        }
      });
    });

    html += '</div></div>';
    view.innerHTML = html;
  };

  App.openCourseEditor = function (day, periodId) {
    var tt = App.state.timetable;
    var cell = tt.cells[App.cellKey(day, periodId)] || null;
    App._courseDay = day;
    App._coursePid = periodId;

    document.getElementById('course-name').value = cell ? cell.name : '';
    document.getElementById('course-location').value = cell ? (cell.location || '') : '';
    document.getElementById('course-teacher').value = cell ? (cell.teacher || '') : '';
    document.getElementById('course-span').value = cell ? (cell.span || 1) : 1;
    App.renderPalette('course-color', cell ? cell.color : App.PALETTE[0]);
    document.getElementById('course-delete').style.display = cell ? 'block' : 'none';
    App.openModal('modal-course');
  };

  App.saveCourse = function () {
    App.captureUndo();
    var tt = App.state.timetable;
    var day = App._courseDay, pid = App._coursePid;
    var key = App.cellKey(day, pid);

    var name = document.getElementById('course-name').value.trim();
    var location = document.getElementById('course-location').value.trim();
    var teacher = document.getElementById('course-teacher').value.trim();
    var color = document.getElementById('course-color').dataset.value;
    var span = parseInt(document.getElementById('course-span').value, 10) || 1;
    if (span < 1) span = 1;
    if (span > tt.periods.length) span = tt.periods.length;

    if (!name) {
      if (tt.cells[key]) { delete tt.cells[key]; Store.save(App.state); App.renderTimetable(); App.toast('已删除'); }
      App.closeModal('modal-course');
      return;
    }

    var idx = -1;
    tt.periods.forEach(function (p, i) { if (p.id === pid) idx = i; });
    for (var k = 1; k < span; k++) {
      var np = tt.periods[idx + k];
      if (np) delete tt.cells[App.cellKey(day, np.id)];
    }

    tt.cells[key] = { name: name, location: location, teacher: teacher, color: color, span: span };
    Store.save(App.state);
    App.renderTimetable();
    App.closeModal('modal-course');
    App.toast('已保存');
  };

  App.deleteCourse = function () {
    App.captureUndo();
    var tt = App.state.timetable;
    delete tt.cells[App.cellKey(App._courseDay, App._coursePid)];
    Store.save(App.state);
    App.renderTimetable();
    App.closeModal('modal-course');
    App.toast('已删除');
  };
})();
