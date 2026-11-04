/* 存储与共享工具 —— 最先加载 */
(function (window) {
  'use strict';

  function defaultPeriods() {
    var defs = [
      ['第1节', '08:00-08:45'], ['第2节', '08:55-09:40'], ['第3节', '10:00-10:45'],
      ['第4节', '10:55-11:40'], ['第5节', '14:00-14:45'], ['第6节', '14:55-15:40'],
      ['第7节', '16:00-16:45'], ['第8节', '16:55-17:40'], ['第9节', '19:00-19:45'],
      ['第10节', '19:55-20:40'], ['第11节', '20:50-21:35'], ['第12节', '21:45-22:30']
    ];
    return defs.map(function (d, i) {
      return { id: 'p' + (i + 1), label: d[0], time: d[1] };
    });
  }

  function defaultSemester() {
    return {
      id: '2026-2027-1',
      name: '2026-2027-1',
      semesterStart: '2026-09-07',
      timetable: { periods: defaultPeriods(), showWeekend: false, cells: {}, todoCells: {} },
      todos: [],
      notes: []
    };
  }

  function normalizeTimetable(tt) {
    var d = defaultSemester().timetable;
    tt = tt || {};
    return {
      periods: (Array.isArray(tt.periods) && tt.periods.length) ? tt.periods : d.periods,
      showWeekend: !!tt.showWeekend,
      cells: (tt.cells && typeof tt.cells === 'object' && !Array.isArray(tt.cells)) ? tt.cells : {},
      todoCells: (tt.todoCells && typeof tt.todoCells === 'object' && !Array.isArray(tt.todoCells)) ? tt.todoCells : {}
    };
  }

  function defaultState() {
    var sem = defaultSemester();
    var state = {
      semesters: {},
      currentSemesterId: sem.id,
      timetable: sem.timetable,
      todos: sem.todos,
      notes: sem.notes,
      semesterStart: sem.semesterStart,
      background: '',
      backgroundOpacity: 1,
      cellOpacity: 0.55,
      currentWeek: 1,
      appName: 'WEEK♕',
      placeEmoji: '⏱',
      unplaceEmoji: '↩'
    };
    state.semesters[sem.id] = sem;
    return state;
  }

  function normalize(obj) {
    obj = obj || {};
    var currentId = (typeof obj.currentSemesterId === 'string' && obj.currentSemesterId) ? obj.currentSemesterId : '2026-2027-1';
    var semesters = (obj.semesters && typeof obj.semesters === 'object' && !Array.isArray(obj.semesters)) ? obj.semesters : null;

    if (!semesters) {
      semesters = {};
      semesters[currentId] = {
        id: currentId,
        name: currentId,
        semesterStart: (typeof obj.semesterStart === 'string' && obj.semesterStart) ? obj.semesterStart : '2026-09-07',
        timetable: normalizeTimetable(obj.timetable),
        todos: Array.isArray(obj.todos) ? obj.todos : [],
        notes: Array.isArray(obj.notes) ? obj.notes : []
      };
    } else {
      for (var k in semesters) {
        var sm = semesters[k];
        sm.id = sm.id || k;
        sm.name = (typeof sm.name === 'string' && sm.name) ? sm.name : k;
        sm.semesterStart = (typeof sm.semesterStart === 'string' && sm.semesterStart) ? sm.semesterStart : '2026-09-07';
        sm.timetable = normalizeTimetable(sm.timetable);
        sm.todos = Array.isArray(sm.todos) ? sm.todos : [];
        sm.notes = Array.isArray(sm.notes) ? sm.notes : [];
      }
    }
    if (!semesters[currentId]) {
      semesters[currentId] = defaultSemester();
    }
    var sem = semesters[currentId];

    return {
      semesters: semesters,
      currentSemesterId: currentId,
      timetable: sem.timetable,
      todos: sem.todos,
      notes: sem.notes,
      semesterStart: sem.semesterStart,
      background: (typeof obj.background === 'string') ? obj.background : '',
      backgroundOpacity: (typeof obj.backgroundOpacity === 'number') ? obj.backgroundOpacity : 1,
      cellOpacity: (typeof obj.cellOpacity === 'number') ? obj.cellOpacity : 0.55,
      currentWeek: (typeof obj.currentWeek === 'number' && obj.currentWeek >= 1) ? obj.currentWeek : 1,
      appName: (typeof obj.appName === 'string' && obj.appName) ? obj.appName : 'WEEK♕',
      placeEmoji: (typeof obj.placeEmoji === 'string' && obj.placeEmoji) ? obj.placeEmoji : '⏱',
      unplaceEmoji: (typeof obj.unplaceEmoji === 'string' && obj.unplaceEmoji) ? obj.unplaceEmoji : '↩'
    };
  }

  var KEY = 'schedule_pwa_v1';

  var Store = {
    KEY: KEY,
    defaultPeriods: defaultPeriods,
    defaultState: defaultState,
    normalize: normalize,
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return defaultState();
        return normalize(JSON.parse(raw));
      } catch (e) {
        return defaultState();
      }
    },
    save: function (state) {
      var sem = state.semesters && state.semesters[state.currentSemesterId];
      if (sem) {
        sem.timetable = state.timetable;
        sem.todos = state.todos;
        sem.notes = state.notes;
        sem.semesterStart = state.semesterStart;
      }
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    },
    exportJSON: function (state) {
      return JSON.stringify(state, null, 2);
    },
    parseJSON: function (text) {
      return JSON.parse(text);
    }
  };

  var App = window.App = {
    DAYS: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    PALETTE: ['#f28695', '#ffc5bb', '#ffd0a9', '#fce7ae', '#ffffff'],
    state: null,
    currentTab: 'timetable',

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    uid: function () {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },

    cellKey: function (day, periodId) {
      return day + '|' + periodId;
    },

    today: function () {
      var d = new Date();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return d.getFullYear() + '-' + m + '-' + day;
    },

    hexToRgba: function (hex, alpha) {
      var h = String(hex || '#f28695').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var r = parseInt(h.substring(0, 2), 16);
      var g = parseInt(h.substring(2, 4), 16);
      var b = parseInt(h.substring(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    },

    dateStr: function (d) {
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return d.getFullYear() + '-' + m + '-' + day;
    },

    weekDates: function () {
      var startStr = App.state.semesterStart || '2026-09-07';
      var start = new Date(startStr + 'T00:00:00');
      var week = App.state.currentWeek || 1;
      var monday = new Date(start.getTime() + (week - 1) * 7 * 86400000);
      var days = [];
      for (var i = 0; i < 7; i++) {
        days.push(new Date(monday.getTime() + i * 86400000));
      }
      return days;
    },

    fmtShortDate: function (d) {
      return (d.getMonth() + 1) + '/' + d.getDate();
    },

    fmtDate: function (s) {
      if (!s) return '';
      var parts = s.split('-');
      if (parts.length !== 3) return s;
      return parts[1] + '月' + parseInt(parts[2], 10) + '日';
    },

    fmtTime: function (t) {
      if (!t) return '';
      var d = new Date(t);
      if (isNaN(d.getTime())) return '';
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      var h = ('0' + d.getHours()).slice(-2);
      var mi = ('0' + d.getMinutes()).slice(-2);
      return m + '月' + day + '日 ' + h + ':' + mi;
    },

    toast: function (msg) {
      var el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(App._toastTimer);
      App._toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
    },

    openModal: function (id) {
      var m = document.getElementById(id);
      if (m) m.classList.add('open');
    },
    closeModal: function (id) {
      var m = document.getElementById(id);
      if (m) m.classList.remove('open');
    },

    confirm: function (msg, onOk) {
      document.getElementById('confirm-msg').textContent = msg;
      App._confirmOk = onOk;
      App.openModal('modal-confirm');
    },

    renderPalette: function (containerId, selected) {
      var box = document.getElementById(containerId);
      if (!box) return;
      box.innerHTML = '';
      App.PALETTE.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch' + (c === selected ? ' selected' : '');
        b.style.background = c;
        b.dataset.color = c;
        b.addEventListener('click', function () {
          var list = box.querySelectorAll('.swatch');
          for (var i = 0; i < list.length; i++) list[i].classList.remove('selected');
          b.classList.add('selected');
          box.dataset.value = c;
        });
        box.appendChild(b);
      });
      box.dataset.value = selected || App.PALETTE[0];
    }
  };

  window.Store = Store;
})(window);
