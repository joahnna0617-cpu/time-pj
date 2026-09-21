/*!
 * Lost & Found: Time — core.js
 * 순수 데이터·로직 계층 (DOM 접근 없음, 외부 의존성 없음).
 * index.html의 <script>에 그대로 인라인한다. 결과: window.LFT
 * 규약: 이 파일의 어떤 공개 함수도 throw 하지 않는다(잘못된 입력은 정규화/기본값으로 처리).
 * 비밀 정보(API 키)는 소스에 두지 않는다. 키는 ./.env(http) 또는 localStorage에서만 읽는다.
 */
(function (root) {
  'use strict';

  /* ================================================================
   * 0. 상수
   * ================================================================ */
  var SCHEMA_VERSION = 1;
  var DAY_HOURS = 24;
  var STEP = 0.25; // 15분
  var PREFIX = 'lft:v' + SCHEMA_VERSION + ':';

  var COLORS = Object.freeze({
    background: '#0F1626',
    text: '#E8E4DA',
    warning: '#E06C5A',
    unclassified: '#2A3348',
    reclaimed: '#8FD3C1',
    driftBase: '#D9B97F'
  });

  var MULTIPLIERS = Object.freeze({ week: 7, month: 30.4, year: 365, decade: 3650 });

  /* ================================================================
   * 1. DATA — 카테고리 (배열 순서 = 링 배치 순서, 00:00부터 시계방향)
   * ================================================================ */
  var CATEGORIES = [
    {
      id: 'sleep', label: '수면', type: 'intent', color: '#3E7C87', defaultHours: 7,
      stories: [
        '이 시간은 꿈 보관함에 따로 보관 중입니다.',
        '베개 밑에서 습득된 일곱 시간. 상태 양호, 약간 구겨짐.',
        '주인이 잠든 사이 접수되었습니다. 깨우지 않았습니다.',
        '어젯밤 꾼 꿈 한 편이 함께 들어왔지만, 줄거리는 분실되었습니다.'
      ],
      conversions: []
    },
    {
      id: 'meal', label: '식사', type: 'intent', color: '#7C93A8', defaultHours: 1.5,
      stories: [
        '숟가락 옆에 놓여 있던 시간입니다. 아직 따뜻합니다.',
        '점심 메뉴를 고르던 15분은 별도 보관함에 있습니다.',
        '국물 한 방울이 묻은 채 접수되었습니다.'
      ],
      conversions: []
    },
    {
      id: 'commute', label: '이동', type: 'drift', color: '#E4CC9D', defaultHours: 1.5,
      place: '길 위에', foundAt: '버스 손잡이에서', code: 'MOVE',
      stories: [
        '환승 통로에서 습득. 교통카드 찍는 소리가 아직 남아 있습니다.',
        '창밖 풍경과 함께 접수된 시간입니다. 풍경은 반환되지 않습니다.',
        '지하철 3호선 선반 위에서 발견되었습니다.',
        '신호 대기 중에 떨어뜨린 것으로 추정됩니다.'
      ],
      conversions: ['book', 'run5k', 'homemeal', 'movie', 'cert', 'halfmarathon', 'instrument', 'europe']
    },
    {
      id: 'work', label: '일·공부', type: 'intent', color: '#5B8A9A', defaultHours: 8,
      stories: [
        '모니터 앞에서 습득된 여덟 시간. 커피 얼룩이 있습니다.',
        '마감 직전의 시간은 유난히 무겁게 접수됩니다.',
        '포스트잇 세 장이 붙은 채 보관 중입니다.'
      ],
      conversions: []
    },
    {
      id: 'talk', label: '사람과 대화', type: 'intent', color: '#4F6D7A', defaultHours: 1,
      stories: [
        '누군가의 웃음소리와 함께 접수되었습니다.',
        '"다음에 밥 한번 먹자"는 약속이 동봉되어 있습니다.',
        '말끝을 흐린 문장 몇 개가 함께 보관 중입니다.'
      ],
      conversions: []
    },
    {
      id: 'exercise', label: '운동', type: 'intent', color: '#6FA3A0', defaultHours: 0.5,
      stories: [
        '땀에 젖은 채 도착했습니다. 건조 중입니다.',
        '계단에서 습득된 30분. 숨이 조금 찹니다.',
        '운동화 끈 사이에 끼어 있던 시간입니다.'
      ],
      conversions: []
    },
    {
      id: 'sns', label: 'SNS', type: 'drift', color: '#D9B97F', defaultHours: 2.5,
      place: '스크롤에', foundAt: '엄지 끝에서', code: 'SNS',
      stories: [
        '엄지 끝에서 발견된 시간입니다. 지문이 선명합니다.',
        '"딱 5분만"이라는 메모와 함께 두 시간 넘게 보관 중입니다.',
        '피드 맨 아래에서 습득. 맨 아래는 끝내 발견되지 않았습니다.',
        '좋아요 버튼 근처에서 주운 시간입니다. 주인은 아직 나타나지 않았습니다.'
      ],
      conversions: ['book', 'run5k', 'homemeal', 'movie', 'cert', 'halfmarathon', 'instrument', 'europe']
    },
    {
      id: 'video', label: '영상·OTT', type: 'drift', color: '#C4A266', defaultHours: 1.5,
      place: '화면 속에', foundAt: '다음 화 자동재생 버튼 옆에서', code: 'OTT',
      stories: [
        '"다음 화 5초 후 재생" 화면에서 습득되었습니다.',
        '소파 쿠션 틈에서 발견. 리모컨과 같은 자리였습니다.',
        '줄거리는 기억나지 않지만 시간은 확실히 여기 있습니다.'
      ],
      conversions: ['book', 'run5k', 'homemeal', 'movie', 'cert', 'halfmarathon', 'instrument', 'europe']
    },
    {
      id: 'idle', label: '멍때리기·대기', type: 'drift', color: '#B08D57', defaultHours: 0.5,
      place: '대기실에', foundAt: '대기실 의자 밑에서', code: 'IDLE',
      stories: [
        '대기 번호표와 함께 접수되었습니다. 호출은 아직입니다.',
        '창밖을 보던 시간입니다. 무엇을 봤는지는 기록되지 않았습니다.',
        '엘리베이터 앞에서 습득. 층수 표시만 기억하고 있습니다.'
      ],
      conversions: ['book', 'run5k', 'homemeal', 'movie', 'cert', 'halfmarathon', 'instrument', 'europe']
    },
    {
      id: 'etc', label: '기타', type: 'drift', color: '#EEDDB9', defaultHours: 0,
      place: '어딘가에', foundAt: '어딘가에서', code: 'ETC',
      stories: [
        '습득 장소 불명. 분류표를 붙이지 못했습니다.',
        '어디에 썼는지 아무도 모르는 시간입니다. 보관소도 모릅니다.',
        '주머니 속 영수증 사이에서 나왔습니다.'
      ],
      conversions: ['book', 'run5k', 'homemeal', 'movie', 'cert', 'halfmarathon', 'instrument', 'europe']
    }
  ];

  /* 교환 항목 공용 풀. scope: week → 일일 시간 × 7, year → 일일 시간 × 365
   * 기준: 주 12h → 책 2권·러닝 12번·집밥 8끼·영화 6편 / 연 624h(26일) → 자격증·하프마라톤 준비·악기 기초·유럽 여행 각 1 */
  var CONVERSIONS = [
    { id: 'book', label: '책', unit: '권', hoursPerUnit: 6, scope: 'week', icon: '📚', template: '책 {n}권' },
    { id: 'run5k', label: '5km 러닝', unit: '번', hoursPerUnit: 1, scope: 'week', icon: '🏃', template: '5km 러닝 {n}번' },
    { id: 'homemeal', label: '집밥', unit: '끼', hoursPerUnit: 1.5, scope: 'week', icon: '🍚', template: '집밥 {n}끼' },
    { id: 'movie', label: '영화', unit: '편', hoursPerUnit: 2, scope: 'week', icon: '🎬', template: '영화 {n}편' },
    { id: 'cert', label: '자격증', unit: '개', hoursPerUnit: 600, scope: 'year', icon: '📜', template: '자격증 {n}개' },
    { id: 'halfmarathon', label: '하프마라톤 준비', unit: '번', hoursPerUnit: 600, scope: 'year', icon: '🏅', template: '하프마라톤 준비 {n}번' },
    { id: 'instrument', label: '악기 기초', unit: '개', hoursPerUnit: 600, scope: 'year', icon: '🎸', template: '악기 {n}개 기초 떼기' },
    { id: 'europe', label: '유럽 여행(25일)', unit: '번', hoursPerUnit: 600, scope: 'year', icon: '✈️', template: '유럽 여행(25일) {n}번' }
  ];

  var DEFAULT_DAY = {
    sleep: 7, work: 8, exercise: 0.5, meal: 1.5, talk: 1,
    sns: 2.5, video: 1.5, commute: 1.5, idle: 0.5, etc: 0
  };

  var TEXTS = {
    remaining: '남은 시간 {t}',
    over: '{t} 초과',
    overWarning: '하루는 24시간뿐입니다. 어딘가에서 시간을 줄여 주세요.',
    overBadge: '입력 확인 중 — 24시간을 넘었습니다',
    emptyRing: '아직 접수된 시간이 없습니다',
    driftTotal: '오늘 접수된 분실 시간: {t}',
    noDrift: '오늘 접수된 분실 시간이 없습니다. 보관소가 한가합니다.',
    idleArchive: '보관소가 한가합니다',
    noReclaim: '되찾을 시간이 없습니다. 이미 모든 시간을 잘 쓰고 계시네요.',
    allReclaimed: '되찾은 하루가 완성되었습니다. 분실물이 모두 주인을 찾았습니다.',
    storageUnavailable: '이 환경에서는 입력이 저장되지 않습니다',
    captureUnavailable: '이미지 저장을 사용할 수 없습니다. 화면을 캡처해 주세요.',
    sourceAi: 'AI 작성',
    sourceFallback: '보관소 기본 문구',
    keyStatusEnv: 'AI 연결됨 (.env)',
    keyStatusStorage: 'AI 연결됨 (브라우저 저장)',
    keyStatusNone: '기본 문구 모드',
    keyNotice: '키는 이 브라우저에만 평문으로 저장됩니다'
  };

  /* 폴백 접수증 문장. 치환자: {top} {topTime} {total} {code} {foundAt} {yearDays} {dayPct} */
  var FALLBACK_TEXTS = [
    '{top} {topTime}을 보관 중입니다. 보관 기한은 없습니다.',
    '분실 시간 {total}, 주인을 기다리는 중입니다.',
    '접수번호 {code}: {foundAt} {topTime}이 발견됨. 주인은 아직 나타나지 않음.',
    '{top} 선반에 {topTime}이 쌓였습니다. 먼지는 아직 없습니다.',
    '오늘 맡기신 {total}, 이대로라면 올해 {yearDays}일이 됩니다.',
    '하루의 {dayPct}%가 분실물 목록에 올랐습니다. 언제든 찾아가실 수 있습니다.',
    '{topTime}짜리 {top} 분실물, 포장 상태 양호. 수령 대기 중.',
    '습득 장소 여러 곳, 습득 시간 {total}. 보관소가 잘 맡아 두겠습니다.',
    '{top}에서 흘린 {topTime}, 교환소에서 다른 것으로 바꿔 드릴 수 있습니다.'
  ];
  /* 습득 장소가 여러 곳임을 전제하는 템플릿 인덱스 → drift 카테고리가 1개면 건너뜀 */
  var MULTI_PLACE_TEXTS = [7];
  var ZERO_TEXTS = [
    '오늘 접수된 분실물이 없습니다. 보관소 직원이 차를 한 잔 더 마십니다.',
    '분실 신고 0건. 보관소가 한가합니다.'
  ];

  var KOREAN_COUNT = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두'];

  /* ---- 파생 인덱스 ---- */
  var CATEGORY_MAP = {};
  var IDS = [];
  var DRIFT_IDS = [];
  var INTENT_IDS = [];
  CATEGORIES.forEach(function (c) {
    CATEGORY_MAP[c.id] = c;
    IDS.push(c.id);
    (c.type === 'drift' ? DRIFT_IDS : INTENT_IDS).push(c.id);
  });
  var CONVERSION_MAP = {};
  CONVERSIONS.forEach(function (v) { CONVERSION_MAP[v.id] = v; });

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  /* ================================================================
   * 2. util
   * ================================================================ */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function round(v, digits) {
    var p = Math.pow(10, digits || 0);
    return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * p) / p;
  }

  function formatNumber(n, digits) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var d = digits || 0;
    var s = Math.abs(v).toFixed(d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts.join('.');
    return (v < 0 && Number(s) !== 0 ? '-' : '') + out;
  }

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }

  /* FNV-1a 32bit → 8자리 hex */
  function hashString(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function debounce(fn, ms) {
    var timer = null;
    var lastArgs = null;
    function run() {
      timer = null;
      var a = lastArgs; lastArgs = null;
      try { fn.apply(null, a || []); } catch (e) { warn('debounce 대상 함수 오류', e); }
    }
    function d() { lastArgs = arguments; if (timer) clearTimeout(timer); timer = setTimeout(run, ms); }
    d.cancel = function () { if (timer) clearTimeout(timer); timer = null; lastArgs = null; };
    d.flush = function () { if (timer) { clearTimeout(timer); run(); } };
    return d;
  }

  function warn(msg, err) {
    try {
      if (root.console && typeof root.console.warn === 'function') {
        root.console.warn('[LFT] ' + msg + (err ? ': ' + (err && err.message ? err.message : String(err)) : ''));
      }
    } catch (e) { /* 콘솔 자체가 없거나 막힌 환경: 로깅 불가, 무시 외 대안 없음 */ }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * 조사 선택: 마지막 글자에 받침이 있으면 withFinal, 없으면 withoutFinal.
   * rieulAsNone=true면 ㄹ 받침을 받침 없음으로 본다("으로/로" 용).
   * 숫자는 한국어 읽기(영·일·이·삼…) 기준, 그 외 문자는 받침 없음으로 본다.
   */
  var DIGIT_FINAL = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 }; // 종성 인덱스
  function josa(word, withFinal, withoutFinal, rieulAsNone) {
    var orig = String(word == null ? '' : word);
    var w = orig.replace(/[\s)\]"'.,!?…]+$/, ''); // 받침 판정용 (닫는 괄호 등은 건너뜀)
    var ch = w.charAt(w.length - 1);
    var code = ch ? ch.charCodeAt(0) : 0;
    var jong = 0;
    if (code >= 0xAC00 && code <= 0xD7A3) jong = (code - 0xAC00) % 28;
    else if (Object.prototype.hasOwnProperty.call(DIGIT_FINAL, ch)) jong = DIGIT_FINAL[ch];
    if (rieulAsNone && jong === 8) jong = 0;
    return orig + (jong ? withFinal : withoutFinal);
  }
  /** "책 2권" → "책 2권으로", "집밥 8끼" → "집밥 8끼로" */
  function withRo(word) { return josa(word, '으로', '로', true); }

  function yyyymmdd(date) {
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  /* ================================================================
   * 3. calc — 순수 계산
   * ================================================================ */

  /** 단일 값 정규화: 숫자/숫자 문자열 허용 → 0~24 clamp → 0.25 스냅. 그 외는 fallback. */
  function normalizeHours(v, fallback) {
    var fb = isNum(fallback) ? fallback : 0;
    var n;
    if (isNum(v)) n = v;
    else if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) n = Number(v);
    else return fb;
    if (n < 0) n = 0;
    if (n > DAY_HOURS) n = DAY_HOURS;
    return Math.round(n / STEP) * STEP;
  }

  /** 하루 객체 정규화: 10개 id 전부 포함, 알 수 없는 id 제거, 잘못된 값은 fallbackDay[id](기본 0). */
  function normalizeDay(day, fallbackDay) {
    var src = day && typeof day === 'object' ? day : {};
    var fb = fallbackDay && typeof fallbackDay === 'object' ? fallbackDay : null;
    var out = {};
    IDS.forEach(function (id) {
      var f = fb && isNum(fb[id]) ? fb[id] : 0;
      out[id] = normalizeHours(src[id], normalizeHours(f, 0));
    });
    return out;
  }

  function zeroDay() { return normalizeDay({}, null); }
  function defaultDay() { return normalizeDay(DEFAULT_DAY, null); }

  function sumOf(h, ids) {
    var s = 0;
    ids.forEach(function (id) { s += h[id]; });
    return round(s, 4);
  }

  function largestDrift(h) {
    var best = null;
    // CATEGORIES 순서(링 배치 순서)대로 순회 → 동률이면 앞선 것이 유지됨
    CATEGORIES.forEach(function (c) {
      if (c.type !== 'drift') return;
      if (h[c.id] > 0 && (!best || h[c.id] > h[best])) best = c.id;
    });
    return best;
  }

  /** 합계·남은시간·초과여부 등 요약 */
  function summary(day) {
    var h = normalizeDay(day, null);
    var total = sumOf(h, IDS);
    var driftTotal = sumOf(h, DRIFT_IDS);
    return {
      hours: h,
      total: total,
      intentTotal: sumOf(h, INTENT_IDS),
      driftTotal: driftTotal,
      remaining: Math.max(0, round(DAY_HOURS - total, 4)),
      over: Math.max(0, round(total - DAY_HOURS, 4)),
      isOver: total > DAY_HOURS,
      isEmpty: total === 0,
      largestDrift: largestDrift(h)
    };
  }

  function driftTotal(day) { return summary(day).driftTotal; }

  /** "○시간 ○분" (15분 반올림, 0분이면 "○시간", 천 단위 쉼표) */
  function formatHM(hours) {
    var v = Number(hours);
    if (!isFinite(v) || v < 0) v = 0;
    var totalMin = Math.round(v * 4) * 15;
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return formatNumber(h) + '시간' + (m ? ' ' + m + '분' : '');
  }

  /** 시각 라벨 "07:00" (24 → "24:00") */
  function formatClock(hour) {
    var v = Number(hour);
    if (!isFinite(v) || v < 0) v = 0;
    if (v > DAY_HOURS) v = DAY_HOURS;
    var mins = Math.round(v * 60);
    return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60);
  }

  function remainingText(day) {
    var s = summary(day);
    return s.isOver ? fill(TEXTS.over, { t: formatHM(s.over) }) : fill(TEXTS.remaining, { t: formatHM(s.remaining) });
  }

  function safeDaily(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, DAY_HOURS);
  }

  /** 누적 시간 { week, month, year, decade } (소수 2자리) */
  function accumulate(dailyHours) {
    var d = safeDaily(dailyHours);
    return {
      week: round(d * MULTIPLIERS.week, 2),
      month: round(d * MULTIPLIERS.month, 2),
      year: round(d * MULTIPLIERS.year, 2),
      decade: round(d * MULTIPLIERS.decade, 2)
    };
  }

  /** 누적 일수 { week, month, year, decade } (시간 ÷ 24, 소수 1자리) */
  function accumulateDays(dailyHours) {
    var a = accumulate(dailyHours);
    return {
      week: round(a.week / 24, 1),
      month: round(a.month / 24, 1),
      year: round(a.year / 24, 1),
      decade: round(a.decade / 24, 1)
    };
  }

  function yearDays(dailyHours) { return safeDaily(dailyHours) * MULTIPLIERS.year / DAY_HOURS; }

  /** 연간 일수 D → "올해 = 26일. 한 달을 통째로 스크롤에 두고 왔습니다." */
  function yearPhrase(days, place) {
    var D = Number(days);
    if (!isFinite(D) || D < 0) D = 0;
    var p = typeof place === 'string' && place ? place : '어딘가에';
    var head, body;
    // 머리말 숫자와 본문 구간 판정 모두 같은 반올림 일수 R을 쓴다 (예: 24.9 → 25일 → "한 달")
    var R = D >= 1 ? Math.round(D) : 0;
    if (D >= 1) head = '올해 = ' + formatNumber(R) + '일.';
    else if (D > 0) head = '올해 = ' + formatHM(D * 24) + '.';
    else head = '올해 = 0일.';

    if (R >= 360) body = '1년을 통째로 ' + p + ' 두고 왔습니다.';
    else if (R >= 25) {
      var m = Math.min(12, Math.max(1, Math.round(R / 30.4)));
      body = KOREAN_COUNT[m] + ' 달을 통째로 ' + p + ' 두고 왔습니다.';
    } else if (R >= 7) body = Math.round(R / 7) + '주를 ' + p + ' 두고 왔습니다.';
    else if (R >= 1) body = R + '일을 ' + p + ' 두고 왔습니다.';
    else if (D > 0) body = formatHM(D * 24) + '을 ' + p + ' 두고 왔습니다.';
    else body = TEXTS.idleArchive + '.';
    return head + ' ' + body;
  }

  /** 하루 입력 → 연간 문구 (drift 합계 기준, 장소는 최대 drift 카테고리) */
  function yearPhraseForDay(day) {
    var s = summary(day);
    var place = s.largestDrift ? CATEGORY_MAP[s.largestDrift].place : '어딘가에';
    return yearPhrase(yearDays(s.driftTotal), place);
  }

  /** scope 시간 → 해당 scope 교환 항목 수량 목록 (0개 제외) */
  function convertScope(scopeHours, scope, ids) {
    var hrs = Number(scopeHours);
    if (!isFinite(hrs) || hrs < 0) hrs = 0;
    var pool = ids ? ids.map(function (id) { return CONVERSION_MAP[id]; }).filter(Boolean) : CONVERSIONS;
    var out = [];
    pool.forEach(function (c) {
      if (c.scope !== scope) return;
      var count = Math.floor(hrs / c.hoursPerUnit + 1e-9);
      if (count <= 0) return;
      var short = fill(c.template, { n: formatNumber(count) });
      out.push({
        id: c.id, label: c.label, unit: c.unit, icon: c.icon, scope: c.scope,
        hoursPerUnit: c.hoursPerUnit, scopeHours: round(hrs, 2), count: count,
        short: short, text: (scope === 'week' ? '매주 ' : '매년 ') + short
      });
    });
    return out;
  }

  /** drift 카테고리 + 일일 시간 → 교환 카드 목록(주 단위 먼저, 년 단위 다음) */
  function conversionsFor(categoryId, dailyHours) {
    var cat = CATEGORY_MAP[categoryId];
    if (!cat || cat.type !== 'drift') return [];
    var d = safeDaily(dailyHours);
    return convertScope(d * MULTIPLIERS.week, 'week', cat.conversions)
      .concat(convertScope(d * MULTIPLIERS.year, 'year', cat.conversions));
  }

  /** 섹션 3 drift 환산 문장 */
  function driftPhrase(categoryId, hours) {
    var h = safeDaily(hours);
    switch (categoryId) {
      case 'sns': return '엄지로 약 ' + formatNumber(snsKm(h), 1) + 'km를 스크롤했습니다'; // snsKm과 같은 반올림(half-up)
      case 'video': {
        var n = Math.floor(h / 2 + 1e-9);
        return n > 0 ? '영화 ' + n + '편 분량을 화면 속에 두고 왔습니다' : '영화 한 편에는 조금 모자란 시간입니다';
      }
      case 'commute': return '하루의 ' + (h / DAY_HOURS * 100).toFixed(1) + '%를 어딘가로 가는 데 썼습니다';
      case 'idle': return '이 시간은 아무도 기억하지 못합니다';
      case 'etc': return '출처를 알 수 없는 ' + formatHM(h) + '이 접수되었습니다';
      default: return '';
    }
  }

  function snsKm(hours) { return round(safeDaily(hours) * 1.8, 1); }
  function commutePercent(hours) { return round(safeDaily(hours) / DAY_HOURS * 100, 1); }

  /** 교환 선택 정리: drift id + 해당 카테고리 conversion id + 시간 > 0 만 유지 */
  function cleanReclaimed(reclaimed, day) {
    var h = normalizeDay(day, null);
    var out = {};
    if (!reclaimed || typeof reclaimed !== 'object') return out;
    Object.keys(reclaimed).forEach(function (id) {
      var cat = CATEGORY_MAP[id];
      var conv = reclaimed[id];
      if (cat && cat.type === 'drift' && h[id] > 0 && typeof conv === 'string' && cat.conversions.indexOf(conv) !== -1) {
        out[id] = conv;
      }
    });
    return out;
  }

  /** 0h 아닌 drift가 1개 이상이고 전부 교환되었는가 */
  function isAllReclaimed(reclaimed, day) {
    var h = normalizeDay(day, null);
    var r = cleanReclaimed(reclaimed, h);
    var active = DRIFT_IDS.filter(function (id) { return h[id] > 0; });
    return active.length > 0 && active.every(function (id) { return !!r[id]; });
  }

  /** 교환 선택 토글: 같은 카드 재선택 → 취소, 다른 카드 → 교체. 새 객체 반환 */
  function toggleReclaim(reclaimed, categoryId, conversionId, day) {
    var next = cleanReclaimed(reclaimed, day);
    if (next[categoryId] === conversionId) delete next[categoryId];
    else next[categoryId] = conversionId;
    return cleanReclaimed(next, day);
  }

  /**
   * 링 조각 계산. 00:00 = 0°(12시), 시계방향. 합계 > 24h면 24/합계로 비례 축소.
   * 0h 조각 제외, 합계 < 24h면 '미분류' 조각 추가.
   * opts.reclaimed: {driftId: conversionId} → 색·라벨 교체
   * opts.minDeg (기본 3): 시각용 최소 각도(display* 필드에만 반영, 계산 필드는 원값)
   */
  function ringSegments(day, opts) {
    var o = opts || {};
    var h = normalizeDay(day, null);
    var total = sumOf(h, IDS);
    var scale = total > DAY_HOURS ? DAY_HOURS / total : 1;
    var dailyForConv = h;
    var reclaimed = cleanReclaimed(o.reclaimed, h);
    var segs = [];
    var cursor = 0;

    CATEGORIES.forEach(function (c) {
      var v = h[c.id];
      if (!(v > 0)) return;
      var start = cursor;
      var end = cursor + v * scale;
      cursor = end;
      var convId = reclaimed[c.id] || null;
      var reclaimText = null;
      if (convId) {
        var cards = conversionsFor(c.id, dailyForConv[c.id]).filter(function (x) { return x.id === convId; });
        reclaimText = cards.length ? cards[0].short : CONVERSION_MAP[convId].label;
      }
      segs.push({
        id: c.id, label: c.label, type: c.type,
        color: convId ? COLORS.reclaimed : c.color,
        baseColor: c.color,
        hours: v,
        reclaimed: convId,
        displayLabel: reclaimText || c.label,
        isUnclassified: false,
        _start: start, _end: end
      });
    });

    if (total < DAY_HOURS) {
      segs.push({
        id: 'unclassified', label: '미분류', type: 'unclassified',
        color: COLORS.unclassified, baseColor: COLORS.unclassified,
        hours: round(DAY_HOURS - total, 4), reclaimed: null, displayLabel: '미분류',
        isUnclassified: true, _start: cursor, _end: DAY_HOURS
      });
    } else if (segs.length) {
      segs[segs.length - 1]._end = DAY_HOURS; // 부동소수 누적 오차 제거
    }

    segs.forEach(function (s) {
      s.startHour = round(s._start, 4);
      s.endHour = round(s._end, 4);
      s.ringHours = round(s._end - s._start, 4);
      s.startAngle = round(s._start * 15, 4);
      s.endAngle = round(s._end * 15, 4);
      s.sweep = round(s.endAngle - s.startAngle, 4);
      s.timeRange = formatClock(s._start) + '–' + formatClock(s._end);
      s.ariaLabel = s.label + ' ' + formatHM(s.hours);
      delete s._start; delete s._end;
    });

    applyMinVisual(segs, isNum(o.minDeg) ? o.minDeg : 3);

    return {
      segments: segs,
      total: total,
      scale: round(scale, 6),
      isOver: total > DAY_HOURS,
      isEmpty: total === 0
    };
  }

  function applyMinVisual(segs, minDeg) {
    var small = segs.filter(function (s) { return s.sweep < minDeg; });
    var canFix = small.length > 0 && segs.length * minDeg < 360;
    var deficit = 0, excess = 0;
    if (canFix) {
      segs.forEach(function (s) {
        if (s.sweep < minDeg) deficit += minDeg - s.sweep;
        else excess += s.sweep - minDeg;
      });
    }
    var a = 0;
    segs.forEach(function (s) {
      var d = s.sweep;
      if (canFix && excess > 0) d = s.sweep < minDeg ? minDeg : s.sweep - deficit * (s.sweep - minDeg) / excess;
      s.displayStartAngle = round(a, 4);
      a += d;
      s.displayEndAngle = round(a, 4);
      s.displaySweep = round(d, 4);
    });
    if (segs.length) segs[segs.length - 1].displayEndAngle = 360;
  }

  /** 배치상 시각(0~24, 24는 0으로 순환)이 속한 조각. 없으면 null */
  function segmentAtHour(segments, hour) {
    var list = Array.isArray(segments) ? segments : (segments && segments.segments) || [];
    var v = Number(hour);
    if (!isFinite(v)) return null;
    v = ((v % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;
    for (var i = 0; i < list.length; i++) {
      if (v >= list[i].startHour && v < list[i].endHour) return list[i];
    }
    return null;
  }

  /** 각도(도, 12시=0 시계방향)가 속한 조각. 기본은 화면에 그린 display 각도 기준 */
  function segmentAtAngle(segments, deg, useDisplay) {
    var list = Array.isArray(segments) ? segments : (segments && segments.segments) || [];
    var v = Number(deg);
    if (!isFinite(v)) return null;
    v = ((v % 360) + 360) % 360;
    var disp = useDisplay !== false;
    for (var i = 0; i < list.length; i++) {
      var s = disp ? list[i].displayStartAngle : list[i].startAngle;
      var e = disp ? list[i].displayEndAngle : list[i].endAngle;
      if (v >= s && v < e) return list[i];
    }
    return null;
  }

  /** 입력 해시(캐시 키) */
  function hashDay(day) {
    var h = normalizeDay(day, null);
    return hashString(IDS.map(function (id) { return id + ':' + h[id]; }).join('|'));
  }

  /** 접수번호 LF-YYYYMMDD-XXXX */
  function receiptNo(day, date) {
    return 'LF-' + yyyymmdd(date) + '-' + hashDay(day).slice(0, 4).toUpperCase();
  }

  function randomStory(categoryId, rnd) {
    var c = CATEGORY_MAP[categoryId];
    if (!c || !c.stories.length) return '';
    var r = typeof rnd === 'function' ? rnd() : Math.random();
    if (!isNum(r) || r < 0 || r >= 1) r = 0;
    return c.stories[Math.floor(r * c.stories.length)];
  }

  /* ================================================================
   * 4. storage — localStorage + 메모리 폴백 (절대 throw 하지 않음)
   * ================================================================ */
  var KEYS = Object.freeze({ state: PREFIX + 'state', apiKey: PREFIX + 'apiKey', receipt: PREFIX + 'receipt' });
  var memory = {};
  var persistent = null; // null = 미확인

  function ls() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function isPersistent() {
    if (persistent !== null) return persistent;
    try {
      var s = ls();
      if (!s) { persistent = false; return false; }
      var k = PREFIX + '__probe';
      s.setItem(k, '1');
      s.removeItem(k);
      persistent = true;
    } catch (e) {
      persistent = false;
    }
    return persistent;
  }

  function rawGet(key) {
    if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key];
    if (!isPersistent()) return null;
    try { var v = ls().getItem(key); return typeof v === 'string' ? v : null; } catch (e) { warn('localStorage 읽기 실패', e); return null; }
  }

  function rawSet(key, value) {
    if (isPersistent()) {
      try { ls().setItem(key, value); delete memory[key]; return true; } catch (e) {
        warn('localStorage 쓰기 실패, 메모리 저장으로 전환', e);
        persistent = false;
      }
    }
    memory[key] = value;
    return false;
  }

  function rawRemove(key) {
    delete memory[key];
    if (!isPersistent()) return;
    try { ls().removeItem(key); } catch (e) { warn('localStorage 삭제 실패', e); }
  }

  function readJSON(key) {
    var raw = rawGet(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { warn('저장값 손상(' + key + '), 무시', e); return null; }
  }

  /** 저장된 상태 로드. 없거나 손상 시 기본 하루. 반환 { hours, reclaimed, updatedAt, restored } */
  function loadState() {
    var data = readJSON(KEYS.state);
    if (!data || typeof data !== 'object' || data.version !== SCHEMA_VERSION || !data.hours || typeof data.hours !== 'object') {
      return { hours: defaultDay(), reclaimed: {}, lastValid: null, updatedAt: null, restored: false };
    }
    var hours = {};
    IDS.forEach(function (id) {
      var v = data.hours[id];
      hours[id] = isNum(v) ? normalizeHours(v, DEFAULT_DAY[id]) : DEFAULT_DAY[id]; // 문자열·NaN 등은 기본값
    });
    var lastValid = readLastValid(data.lastValid);
    // 교환 선택은 섹션 3~5 기준 하루(lastValid, 없으면 hours)에 맞춰 정리
    var basis = lastValid || (summary(hours).isOver ? defaultDay() : hours);
    return {
      hours: hours,
      reclaimed: cleanReclaimed(data.reclaimed, basis),
      lastValid: lastValid,
      updatedAt: isNum(data.updatedAt) ? data.updatedAt : null,
      restored: true
    };
  }

  /** 저장된 마지막 유효 하루: 객체이고 합계 ≤ 24h일 때만 인정. 아니면 null */
  function readLastValid(v) {
    if (!v || typeof v !== 'object') return null;
    var d = normalizeDay(v, null);
    return summary(d).isOver ? null : d;
  }

  /** 상태 저장. localStorage에 영속되면 true, 메모리 폴백이면 false.
   *  state.lastValid(선택): 마지막 유효(≤24h) 하루. 초과 상태로 새로고침해도 섹션 3~5가 이 값을 쓴다. */
  function saveState(state) {
    try {
      var s = state && typeof state === 'object' ? state : {};
      var hours = normalizeDay(s.hours, null);
      var lastValid = readLastValid(s.lastValid) || (summary(hours).isOver ? null : hours);
      var payload = {
        version: SCHEMA_VERSION,
        hours: hours,
        reclaimed: cleanReclaimed(s.reclaimed, lastValid || hours),
        updatedAt: Date.now()
      };
      if (lastValid) payload.lastValid = lastValid;
      return rawSet(KEYS.state, JSON.stringify(payload));
    } catch (e) { warn('상태 저장 실패', e); return false; }
  }

  function clearState() { rawRemove(KEYS.state); }

  var KEY_PATTERN = /^[\x21-\x7E]{8,512}$/;
  function cleanKey(k) {
    if (typeof k !== 'string') return null;
    var t = k.trim();
    return KEY_PATTERN.test(t) ? t : null;
  }

  function getStoredApiKey() { return cleanKey(rawGet(KEYS.apiKey)); }
  /** 유효 형식(공백 없는 ASCII 8~512자)이면 저장 후 true, 아니면 false */
  function setApiKey(k) {
    var c = cleanKey(k);
    if (!c) return false;
    rawSet(KEYS.apiKey, c);
    return true;
  }
  function removeApiKey() { rawRemove(KEYS.apiKey); }

  function loadReceipt() {
    var r = readJSON(KEYS.receipt);
    if (!r || typeof r !== 'object' || typeof r.hash !== 'string' || typeof r.text !== 'string' || !r.text ||
        (r.source !== 'ai' && r.source !== 'fallback')) return null;
    return { hash: r.hash, text: r.text, source: r.source };
  }
  function saveReceipt(r) {
    if (!r || typeof r.hash !== 'string' || typeof r.text !== 'string') return false;
    return rawSet(KEYS.receipt, JSON.stringify({ hash: r.hash, text: r.text, source: r.source === 'ai' ? 'ai' : 'fallback' }));
  }
  function clearReceipt() { rawRemove(KEYS.receipt); }

  /* ================================================================
   * 5. ai — OpenRouter 접수증 (절대 reject 하지 않음)
   * ================================================================ */
  var MODEL = 'google/gemma-4-26b-a4b-it:free';
  var ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  var TIMEOUT_MS = 10000;
  var ENV_TIMEOUT_MS = 3000;
  var APP_TITLE = 'Lost & Found: Time';
  var SYSTEM_PROMPT =
    '당신은 분실물 보관소 직원. 사용자의 하루 시간 배분을 보고 분실물 접수증 비고란에 쓸 한국어 한 문장(60자 이내)을 쓴다. ' +
    '비난하지 말고 담담하고 위트 있게. 따옴표·이모지·줄바꿈 금지. ' +
    '예: 접수번호 0922-SNS: 엄지 끝에서 3시간 15분이 발견됨. 주인은 아직 나타나지 않음.';

  var envKeyPromise = null;

  function isHttpPage() {
    try { return !!root.location && /^https?:$/.test(root.location.protocol); } catch (e) { return false; }
  }

  /** .env 텍스트에서 OPENROUTER_API_KEY 파싱 (export 접두, 따옴표, 공백, 주석 허용) */
  function parseEnv(text) {
    if (typeof text !== 'string') return null;
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '#') continue;
      var m = line.match(/^(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*)$/);
      if (!m) continue;
      var v = m[1].trim();
      var q = v.charAt(0);
      if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) v = v.slice(1, v.indexOf(q, 1));
      else v = v.replace(/\s+#.*$/, '').trim();
      return cleanKey(v);
    }
    return null;
  }

  function fetchWithTimeout(fetchImpl, url, init, ms) {
    var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = null;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* abort 실패해도 아래 reject로 종료됨 */ } }
        reject(new Error('timeout ' + ms + 'ms'));
      }, ms);
    });
    var req = Promise.resolve().then(function () {
      return fetchImpl(url, Object.assign({}, init, ctrl ? { signal: ctrl.signal } : {}));
    });
    return {
      response: Promise.race([req, timeout]),
      race: function (p) { return Promise.race([p, timeout]); },
      done: function () { if (timer) clearTimeout(timer); timer = null; }
    };
  }

  function loadEnvKey(fetchImpl) {
    if (!isHttpPage()) return Promise.resolve(null); // file:// 에서는 시도하지 않음
    var f = fetchImpl || root.fetch;
    if (typeof f !== 'function') return Promise.resolve(null);
    var t = fetchWithTimeout(f, './.env', { cache: 'no-store' }, ENV_TIMEOUT_MS);
    return t.response
      .then(function (res) { return res && res.ok ? t.race(res.text()) : null; })
      .then(function (text) { return parseEnv(text); })
      .catch(function () { return null; })
      .then(function (k) { t.done(); return k; });
  }

  /** 키 결정: .env(http 전용, 세션 캐시) → localStorage → none. 반환 Promise<{key, source}> */
  function resolveKey(opts) {
    var o = opts || {};
    if (!envKeyPromise || o.refresh) envKeyPromise = loadEnvKey(o.fetch);
    return envKeyPromise.then(function (envKey) {
      if (envKey) return { key: envKey, source: 'env' };
      var stored = getStoredApiKey();
      if (stored) return { key: stored, source: 'storage' };
      return { key: null, source: 'none' };
    }).catch(function () { return { key: null, source: 'none' }; });
  }

  function getApiKey(opts) { return resolveKey(opts).then(function (r) { return r.key; }); }

  function resetKeyCache() { envKeyPromise = null; }

  function buildMessages(day) {
    var s = summary(day);
    var h = s.hours;
    var list = CATEGORIES.map(function (c) {
      return c.label + '(' + (c.type === 'drift' ? '분실' : '의도') + ') ' + formatHM(h[c.id]);
    }).join(', ');
    var top = s.largestDrift ? CATEGORY_MAP[s.largestDrift] : null;
    var user = '하루 시간 배분: ' + list + '. 분실 시간 합계 ' + formatHM(s.driftTotal) + '.';
    if (top) user += ' 가장 큰 분실물: ' + top.label + ' ' + formatHM(h[top.id]) + ' (접수 코드 ' + top.code + ').';
    user += ' 접수증 비고 한 줄만 출력.';
    return [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }];
  }

  var QUOTE_RE = /^[\s"'`“”‘’«»「」『』]+|[\s"'`“”‘’«»「」『』]+$/g;

  /** 응답 후처리: 첫 비어있지 않은 줄, 앞뒤 따옴표·공백 제거, 80자 초과 시 79자 + "…". 비면 '' */
  function sanitize(text) {
    if (typeof text !== 'string') return '';
    var lines = text.split(/\r?\n/).map(function (l) { return l.replace(QUOTE_RE, ''); }).filter(Boolean);
    var line = lines.length ? lines[0] : '';
    var chars = Array.from(line);
    if (chars.length > 80) line = chars.slice(0, 79).join('') + '…';
    return line;
  }

  function extractContent(json) {
    try {
      var c = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.map(function (p) { return p && typeof p.text === 'string' ? p.text : ''; }).join('');
    } catch (e) { /* 형식 불일치 → 빈 문자열로 폴백 처리 */ }
    return '';
  }

  function referer() {
    try { if (isHttpPage()) return root.location.origin + root.location.pathname; } catch (e) { /* 아래 기본값 */ }
    return 'https://lost-found-time.local/';
  }

  function callOpenRouter(key, day, fetchImpl) {
    var t = fetchWithTimeout(fetchImpl, ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer(),
        'X-Title': APP_TITLE
      },
      body: JSON.stringify({ model: MODEL, messages: buildMessages(day), max_tokens: 120, temperature: 0.9 })
    }, TIMEOUT_MS);
    return t.response
      .then(function (res) {
        if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'no response'));
        return t.race(res.json());
      })
      .then(function (json) { t.done(); return extractContent(json); },
            function (err) { t.done(); throw err; });
  }

  /** 입력값으로 채운 기본 문장. seed(정수)로 변형 선택, 기본은 입력 해시 기반(같은 입력 = 같은 문장) */
  function fallbackText(day, seed, date) {
    var s = summary(day);
    var hash = hashDay(s.hours);
    var base = parseInt(hash.slice(0, 6), 16) + (isNum(seed) ? Math.floor(Math.abs(seed)) : 0);
    if (s.driftTotal <= 0) return ZERO_TEXTS[base % ZERO_TEXTS.length];
    var top = CATEGORY_MAP[s.largestDrift];
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    var vars = {
      top: top.label,
      topTime: formatHM(s.hours[top.id]),
      total: formatHM(s.driftTotal),
      code: pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + top.code,
      foundAt: top.foundAt,
      yearDays: formatNumber(Math.round(yearDays(s.driftTotal))),
      dayPct: (Math.min(s.driftTotal, DAY_HOURS) / DAY_HOURS * 100).toFixed(1)
    };
    var activeDrift = DRIFT_IDS.filter(function (id) { return s.hours[id] > 0; }).length;
    var idx = base % FALLBACK_TEXTS.length;
    if (activeDrift < 2 && MULTI_PLACE_TEXTS.indexOf(idx) !== -1) idx = (idx + 1) % FALLBACK_TEXTS.length;
    return fill(FALLBACK_TEXTS[idx], vars);
  }

  var inflight = {};

  /**
   * 접수증 한 줄 생성. 반환 Promise<{ text, source: 'ai'|'fallback', hash }> — 절대 reject 안 함.
   * opts: { force: 캐시 무시, seed: 폴백 변형, fetch: 테스트용 fetch 주입 }
   * 네트워크 없이 즉시 폴백: 키 없음 / 합계 > 24h / drift 합계 0 / fetch 없음
   */
  function generateReceipt(day, opts) {
    var o = opts || {};
    var h, hash, fb;
    try {
      h = normalizeDay(day, null);
      hash = hashDay(h);
      fb = { text: fallbackText(h, o.seed), source: 'fallback', hash: hash };
    } catch (e) {
      warn('접수증 준비 실패', e);
      return Promise.resolve({ text: ZERO_TEXTS[0], source: 'fallback', hash: '' });
    }
    var key = hash + (o.force ? ':force' : '');
    if (inflight[key]) return inflight[key];

    var p = Promise.resolve().then(function () {
      var s = summary(h);
      if (s.isOver || s.driftTotal <= 0) return fb;
      if (!o.force) {
        var cached = loadReceipt();
        if (cached && cached.hash === hash && cached.source === 'ai') return cached;
      }
      var f = o.fetch || root.fetch;
      return resolveKey({ fetch: o.fetch }).then(function (r) {
        if (!r.key || typeof f !== 'function') return fb;
        return callOpenRouter(r.key, h, f).then(function (raw) {
          var text = sanitize(raw);
          if (!text) { warn('AI 응답이 비어 있어 기본 문구 사용'); return fb; }
          var result = { text: text, source: 'ai', hash: hash };
          saveReceipt(result);
          return result;
        });
      });
    }).catch(function (err) {
      warn('AI 접수증 실패, 기본 문구 사용', err);
      return fb;
    }).then(function (res) {
      delete inflight[key];
      return res;
    });
    inflight[key] = p;
    return p;
  }

  /* ================================================================
   * 6. 노출
   * ================================================================ */
  deepFreeze(CATEGORIES);
  deepFreeze(CONVERSIONS);
  deepFreeze(DEFAULT_DAY);
  deepFreeze(TEXTS);
  deepFreeze(FALLBACK_TEXTS);
  deepFreeze(ZERO_TEXTS);

  var DATA = Object.freeze({
    SCHEMA_VERSION: SCHEMA_VERSION,
    DAY_HOURS: DAY_HOURS,
    STEP: STEP,
    COLORS: COLORS,
    MULTIPLIERS: MULTIPLIERS,
    CATEGORIES: CATEGORIES,
    CATEGORY_MAP: Object.freeze(CATEGORY_MAP),
    IDS: Object.freeze(IDS),
    DRIFT_IDS: Object.freeze(DRIFT_IDS),
    INTENT_IDS: Object.freeze(INTENT_IDS),
    CONVERSIONS: CONVERSIONS,
    CONVERSION_MAP: Object.freeze(CONVERSION_MAP),
    DEFAULT_DAY: DEFAULT_DAY,
    TEXTS: TEXTS,
    FALLBACK_TEXTS: FALLBACK_TEXTS,
    ZERO_TEXTS: ZERO_TEXTS
  });

  var LFT = {
    version: '1.0.0',
    DATA: DATA,
    CATEGORIES: CATEGORIES,
    DEFAULT_DAY: DEFAULT_DAY,
    calc: Object.freeze({
      normalizeHours: normalizeHours, normalizeDay: normalizeDay, zeroDay: zeroDay, defaultDay: defaultDay,
      summary: summary, driftTotal: driftTotal, largestDrift: function (d) { return largestDrift(normalizeDay(d, null)); },
      formatHM: formatHM, formatClock: formatClock, formatNumber: formatNumber, remainingText: remainingText,
      accumulate: accumulate, accumulateDays: accumulateDays, yearDays: yearDays,
      yearPhrase: yearPhrase, yearPhraseForDay: yearPhraseForDay,
      convertScope: convertScope, conversionsFor: conversionsFor,
      driftPhrase: driftPhrase, snsKm: snsKm, commutePercent: commutePercent,
      cleanReclaimed: cleanReclaimed, isAllReclaimed: isAllReclaimed, toggleReclaim: toggleReclaim,
      ringSegments: ringSegments, segmentAtHour: segmentAtHour, segmentAtAngle: segmentAtAngle,
      hashDay: hashDay, receiptNo: receiptNo, randomStory: randomStory
    }),
    storage: Object.freeze({
      KEYS: KEYS,
      isPersistent: isPersistent,
      loadState: loadState, saveState: saveState, clearState: clearState,
      getApiKey: getStoredApiKey, setApiKey: setApiKey, removeApiKey: removeApiKey,
      loadReceipt: loadReceipt, saveReceipt: saveReceipt, clearReceipt: clearReceipt
    }),
    ai: Object.freeze({
      MODEL: MODEL, ENDPOINT: ENDPOINT, TIMEOUT_MS: TIMEOUT_MS,
      isHttpPage: isHttpPage, parseEnv: parseEnv,
      resolveKey: resolveKey, getApiKey: getApiKey, resetKeyCache: resetKeyCache,
      buildMessages: buildMessages, sanitize: sanitize, fallbackText: fallbackText,
      generateReceipt: generateReceipt
    }),
    util: Object.freeze({ debounce: debounce, hashString: hashString, fill: fill, josa: josa, withRo: withRo })
  };

  root.LFT = Object.freeze(LFT);
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LFT;
})(typeof window !== 'undefined' ? window : globalThis);
