(() => {
  'use strict';

  const locales = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de', 'pt-BR', 'hi', 'ar'];
  const names = {
    system: 'System', ja: '日本語', en: 'English', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', ko: '한국어',
    es: 'Español', fr: 'Français', de: 'Deutsch', 'pt-BR': 'Português', hi: 'हिन्दी', ar: 'العربية'
  };
  const rtl = new Set(['ar']);

  const english = new Map(Object.entries({
    '本文へ移動': 'Skip to content',
    'ASTERIA ホーム': 'ASTERIA Home',
    'メインナビゲーション': 'Main navigation',
    'ライトテーマに切り替える': 'Switch to light theme',
    'ダークテーマに切り替える': 'Switch to dark theme',
    'ASTERIAのダッシュボード画面': 'ASTERIA dashboard preview',
    'ASTERIA 4.5のホームダッシュボード': 'ASTERIA 4.5 home dashboard',
    'ASTERIAの特長': 'ASTERIA highlights',
    '11の対応言語': 'Eleven supported languages',
    'NEXUSのローカル自動化画面': 'NEXUS local automation screen',
    'NEXUSのミッションテンプレート画面': 'NEXUS mission templates screen',
    'NEXUSのデータ診断画面': 'NEXUS data diagnostics screen',
    'テーマカラー例': 'Theme color samples',
    '機能紹介': 'Feature showcase',
    '対応形式': 'Supported formats',
    'ASTERIA Bridgeのサービス連携画面': 'ASTERIA Bridge service connections screen',
    '機能': 'Features',
    'プライバシー': 'Privacy',
    'ダウンロード': 'Download',
    'Windows版をダウンロード': 'Download for Windows',
    '4.0を見る': 'Explore 4.5',
    '4.5を見る': 'Explore 4.5',
    '毎日を、': 'Bring every day into',
    '静かな軌道へ。': 'a quieter orbit.',
    '予定、ミッション、集中、習慣、記録。ASTERIAは、散らばった毎日を 一つの美しいワークスペースへまとめるWindowsアプリです。': 'Plans, missions, focus, habits and notes. ASTERIA brings a scattered day into one beautiful Windows workspace.',
    'アカウント不要': 'No account',
    '起動した瞬間から使える': 'Ready the moment it launches',
    'データは端末内': 'Data stays local',
    'クラウドへ自動送信しない': 'Never uploaded automatically',
    '開かれた形式': 'Open formats',
    'あなたの見た目': 'Your visual style',
    '色 · 明暗 · モーション': 'Color · light · motion',
    'あなたの仕事を理解する。': 'Understands your work.',
    'あなたに代わって決めつけない。': 'Never decides for you.',
    '11言語。ひとつの静かな体験。': 'Eleven languages. One calm experience.',
    'OS言語を自動検出し、設定からいつでも切り替えられます。翻訳はすべてアプリに内蔵され、 タスクやログを外部の翻訳サービスへ送信しません。': 'ASTERIA detects your system language and lets you switch at any time. Every translation is built in; missions and logs are never sent to an external translation service.',
    'NEXUSは、何が起きるかを常に見せるローカル知能層です。ルール、展開、修復は 端末内で完結し、結果は監査でき、直後なら元に戻せます。': 'NEXUS is a transparent local intelligence layer. Rules, deployments and repairs stay on your device, remain auditable and can be undone immediately.',
    '条件も、処理も、見える自動化。': 'Automation with visible conditions and actions.',
    '期限切れの優先度調整、今日の空き時間への配置、完了ログの記録。安全な処理だけを選び、有効化前に内容を確認できます。': 'Prioritize overdue work, fill open time and record completions. Choose only predictable actions and review every rule before enabling it.',
    '初期状態はすべて停止': 'Disabled by default',
    '重複を避ける冪等処理': 'Idempotent execution',
    '実行履歴とUndo': 'History and Undo',
    '考え方ごと、展開する。': 'Deploy a complete way of working.',
    'プロジェクト、ミッション、予定を一括生成。4つの収録テンプレートに加え、自分の成功パターンを保存できます。': 'Create projects, missions and time blocks together. Start with four built-in templates or save your own successful pattern.',
    '壊れる前に、気づける。': 'See problems before they break your flow.',
    '重複、参照切れ、予定衝突、長期停滞をスキャン。修復は対象を限定し、元のデータをできるだけ残します。': 'Scan duplicates, broken references, schedule conflicts and stalled work. Repairs remain scoped and preserve original data.',
    'データを閉じ込めない。': 'Your data is never trapped.',
    'Google Calendar、Outlook、Todoist、Notion、Trello、Excelへ。JSON、CSV、ICS、Markdownを使い、認証情報なしで安全に受け渡せます。': 'Exchange data with Google Calendar, Outlook, Todoist, Notion, Trello and Excel through JSON, CSV, ICS and Markdown—without storing credentials.',
    '色も、明るさも、動きも。': 'Your colors, brightness and motion.',
    '任意色から完全なセマンティックパレットを生成。ライト、ダーク、システム連動と、3段階のモーションを選べます。': 'Generate a complete semantic palette from any color. Choose light, dark or system appearance and accessible motion settings.',
    'プロジェクト、期限、優先度、サブタスク、繰り返し。リストとボードを自由に切り替えます。': 'Projects, due dates, priorities, subtasks and recurrence—switch freely between list and board.',
    '日・週・月の予定を一つの流れで。ORBIT ASSISTが重要な仕事を空き時間へ配置します。': 'Plan days, weeks and months in one flow. ORBIT ASSIST places important work into open time.',
    '25、50、90分とカスタムタイマー。集中状態は再起動後も復元され、環境音は端末内で生成します。': 'Use 25, 50, 90-minute or custom timers. Focus state survives restarts and soundscapes are generated locally.',
    '思考をMarkdownで残し、習慣と実績を分析。記録が次の行動を選ぶ材料になります。': 'Capture thoughts in Markdown and review habits and progress. Your history helps shape the next action.',
    'ミッション、プロジェクト、予定、習慣、ログ、自動化、テンプレートを横断。探す時間を、進む時間へ戻します。': 'Search missions, projects, plans, habits, logs, automations and templates from one command surface.',
    '管理するためではなく、': 'Not to manage your life—',
    '前へ進むための道具。': 'to help you move forward.',
    'あなたの毎日は、': 'Your day belongs',
    'あなたの端末に。': 'on your device.',
    'アカウントも、テレメトリも、クラウド認証情報も不要。ASTERIA 4.5は、個人データを外部へ自動送信しません。': 'No account, telemetry or cloud credentials. ASTERIA 4.5 never sends personal data automatically.',
    'ですべてへ。': 'Access everything.',
    '軌道を検索...': 'Search your orbit…',
    'プライバシー設計を読む': 'Read the privacy design',
    'ASTERIA 4.0を始める。': 'Start with ASTERIA 4.5.',
    'ASTERIA 4.5を始める。': 'Start with ASTERIA 4.5.',
    'Windows x64 · ポータブル · インストール不要': 'Windows x64 · Portable · No installation',
    '使い方を読む': 'Read the guide',
    '現在のEXEはAuthenticode未署名です。初回起動時にSmartScreenが表示される場合があります。': 'The current EXE is not Authenticode-signed. Windows SmartScreen may appear on first launch.',
    'コピー': 'Copy',
    'SHA-256をコピーしました': 'SHA-256 copied',
    'SHA-256を選択しました': 'SHA-256 selected',
    '外部API通信': 'External API traffic',
    '主要な変更操作': 'Major data changes',
    'データ保存先': 'Data storage',
    '安全な読込上限': 'Safe import limit'
  }));

  const coreRows = [
    ['11言語。ひとつの静かな体験。', 'Eleven languages. One calm experience.', '十一种语言，一种宁静体验。', '十一種語言，一種寧靜體驗。', '11개 언어, 하나의 고요한 경험.', 'Once idiomas. Una experiencia serena.', 'Onze langues. Une expérience sereine.', 'Elf Sprachen. Ein ruhiges Erlebnis.', 'Onze idiomas. Uma experiência tranquila.', 'ग्यारह भाषाएँ। एक शांत अनुभव।', 'إحدى عشرة لغة. تجربة هادئة واحدة.'],
    ['言語', 'Language', '语言', '語言', '언어', 'Idioma', 'Langue', 'Sprache', 'Idioma', 'भाषा', 'اللغة'],
    ['機能', 'Features', '功能', '功能', '기능', 'Funciones', 'Fonctions', 'Funktionen', 'Recursos', 'विशेषताएँ', 'الميزات'],
    ['プライバシー', 'Privacy', '隐私', '隱私', '개인정보', 'Privacidad', 'Confidentialité', 'Datenschutz', 'Privacidade', 'गोपनीयता', 'الخصوصية'],
    ['ダウンロード', 'Download', '下载', '下載', '다운로드', 'Descargar', 'Télécharger', 'Download', 'Baixar', 'डाउनलोड', 'تنزيل'],
    ['Windows版をダウンロード', 'Download for Windows', '下载 Windows 版', '下載 Windows 版', 'Windows용 다운로드', 'Descargar para Windows', 'Télécharger pour Windows', 'Für Windows herunterladen', 'Baixar para Windows', 'Windows के लिए डाउनलोड', 'تنزيل لنظام Windows'],
    ['毎日を、', 'Bring every day into', '让每一天，', '讓每一天，', '매일을,', 'Lleva cada día a', 'Placez chaque journée sur', 'Bring jeden Tag in', 'Leve cada dia para', 'हर दिन को लाएँ', 'اجعل كل يوم في'],
    ['静かな軌道へ。', 'a quieter orbit.', '进入宁静轨道。', '進入寧靜軌道。', '고요한 궤도로.', 'una órbita más tranquila.', 'une orbite plus sereine.', 'eine ruhigere Umlaufbahn.', 'uma órbita mais tranquila.', 'एक शांत कक्षा में।', 'مدار أكثر هدوءًا.'],
    ['アカウント不要', 'No account', '无需账户', '無需帳號', '계정 불필요', 'Sin cuenta', 'Sans compte', 'Kein Konto', 'Sem conta', 'खाता आवश्यक नहीं', 'بلا حساب'],
    ['データは端末内', 'Data stays local', '数据保留在本机', '資料保留在本機', '데이터는 기기에', 'Datos locales', 'Données locales', 'Daten bleiben lokal', 'Dados locais', 'डेटा लोकल रहता है', 'البيانات محلية'],
    ['開かれた形式', 'Open formats', '开放格式', '開放格式', '개방형 형식', 'Formatos abiertos', 'Formats ouverts', 'Offene Formate', 'Formatos abertos', 'खुले प्रारूप', 'تنسيقات مفتوحة'],
    ['あなたの見た目', 'Your visual style', '你的视觉风格', '你的視覺風格', '나만의 화면', 'Tu estilo visual', 'Votre style visuel', 'Dein Erscheinungsbild', 'Seu estilo visual', 'आपकी दृश्य शैली', 'مظهرك الخاص'],
    ['使い方を読む', 'Read the guide', '阅读指南', '閱讀指南', '가이드 보기', 'Leer la guía', 'Lire le guide', 'Anleitung lesen', 'Ler o guia', 'गाइड पढ़ें', 'قراءة الدليل'],
    ['コピー', 'Copy', '复制', '複製', '복사', 'Copiar', 'Copier', 'Kopieren', 'Copiar', 'कॉपी', 'نسخ']
  ];

  const localized = Object.fromEntries(locales.map((locale) => [locale, new Map()]));
  coreRows.forEach((row) => locales.forEach((locale, index) => localized[locale].set(row[0], row[index] || row[1])));
  const textMemory = new WeakMap();
  const attrMemory = new WeakMap();
  let selected = 'system';
  let active = 'ja';
  let changing = false;

  function normalize(value) {
    const source = String(value || '').toLowerCase();
    if (value === 'system') return 'system';
    if (source.startsWith('zh-tw') || source.startsWith('zh-hk') || source.startsWith('zh-hant')) return 'zh-TW';
    if (source.startsWith('zh')) return 'zh-CN';
    if (source.startsWith('pt')) return 'pt-BR';
    return locales.find((locale) => locale.toLowerCase() === source || locale.toLowerCase() === source.split('-')[0]) || 'en';
  }

  function resolve(value) {
    if (value !== 'system') return normalize(value);
    for (const language of navigator.languages || [navigator.language]) {
      const candidate = normalize(language);
      if (locales.includes(candidate)) return candidate;
    }
    return 'en';
  }

  function t(source) {
    if (active === 'ja') return source;
    return localized[active]?.get(source) || english.get(source) || source;
  }

  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest('script, style, code, pre, [data-i18n-skip]')) return;
    let memory = textMemory.get(node);
    if (!memory || node.nodeValue !== memory.rendered) memory = { source: node.nodeValue, rendered: node.nodeValue };
    const leading = memory.source.match(/^\s*/)[0];
    const trailing = memory.source.match(/\s*$/)[0];
    const core = memory.source.slice(leading.length, memory.source.length - trailing.length).replace(/\s+/g, ' ');
    const rendered = core ? `${leading}${t(core)}${trailing}` : memory.source;
    textMemory.set(node, { source: memory.source, rendered });
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }

  function translateAttributes(element) {
    if (!element?.getAttribute || element.closest('[data-i18n-skip]')) return;
    const attributes = ['aria-label', 'alt', 'title'];
    const memory = attrMemory.get(element) || {};
    attributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute);
      const entry = memory[attribute];
      const source = !entry || current !== entry.rendered ? current : entry.source;
      const rendered = t(source);
      memory[attribute] = { source, rendered };
      if (current !== rendered) element.setAttribute(attribute, rendered);
    });
    attrMemory.set(element, memory);
  }

  function apply(root = document.body) {
    if (!root || changing) return;
    changing = true;
    translateAttributes(root);
    root.querySelectorAll('*').forEach(translateAttributes);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateText(node);
    changing = false;
  }

  function setLocale(value) {
    selected = value === 'system' ? 'system' : normalize(value);
    active = resolve(selected);
    document.documentElement.lang = active;
    document.documentElement.dir = rtl.has(active) ? 'rtl' : 'ltr';
    document.documentElement.dataset.locale = active;
    apply();
    window.dispatchEvent(new CustomEvent('asteria-site-localechange', { detail: { selected, locale: active } }));
    return active;
  }

  function populate(select) {
    select.replaceChildren(...['system', ...locales].map((locale) => {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = names[locale];
      option.setAttribute('data-i18n-skip', '');
      return option;
    }));
    select.value = selected;
  }

  const saved = localStorage.getItem('asteria-site-locale') || 'system';
  selected = saved === 'system' ? 'system' : normalize(saved);
  active = resolve(selected);
  const api = { locales, names, t, apply, setLocale, populate, currentLocale: () => active, selectedLocale: () => selected };
  globalThis.AsteriaSiteI18n = api;
})();
