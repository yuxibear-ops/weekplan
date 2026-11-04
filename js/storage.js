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

  function defaultState() {
    return {
      timetable: { periods: defaultPeriods(), showWeekend: false, cells: {}, todoCells: {} },
      todos: [],
      notes: [],
      background: '',
      backgroundOpacity: 1,
      currentWeek: 1
    };
  }

  function normalize(obj) {
    var d = defaultState();
    obj = obj || {};
    var tt = obj.timetable || {};
    return {
      timetable: {
        periods: (Array.isArray(tt.periods) && tt.periods.length) ? tt.periods : d.timetable.periods,
        showWeekend: !!tt.showWeekend,
        cells: (tt.cells && typeof tt.cells === 'object' && !Array.isArray(tt.cells)) ? tt.cells : {},
        todoCells: (tt.todoCells && typeof tt.todoCells === 'object' && !Array.isArray(tt.todoCells)) ? tt.todoCells : {}
      },
      todos: Array.isArray(obj.todos) ? obj.todos : [],
      notes: Array.isArray(obj.notes) ? obj.notes : [],
      background: (typeof obj.background === 'string') ? obj.background : '',
      backgroundOpacity: (typeof obj.backgroundOpacity === 'number') ? obj.backgroundOpacity : 1,
      currentWeek: (typeof obj.currentWeek === 'number' && obj.currentWeek >= 1) ? obj.currentWeek : 1
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
