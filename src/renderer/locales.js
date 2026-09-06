(() => {
  'use strict';

  const localeDefinitions = Object.freeze([
    { id: 'system', label: 'System language', nativeLabel: 'System language', dir: 'ltr' },
    { id: 'ja', label: 'Japanese', nativeLabel: '日本語', dir: 'ltr' },
    { id: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
    { id: 'zh-CN', label: 'Chinese (Simplified)', nativeLabel: '简体中文', dir: 'ltr' },
    { id: 'zh-TW', label: 'Chinese (Traditional)', nativeLabel: '繁體中文', dir: 'ltr' },
    { id: 'ko', label: 'Korean', nativeLabel: '한국어', dir: 'ltr' },
    { id: 'es', label: 'Spanish', nativeLabel: 'Español', dir: 'ltr' },
    { id: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' },
    { id: 'de', label: 'German', nativeLabel: 'Deutsch', dir: 'ltr' },
    { id: 'pt-BR', label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)', dir: 'ltr' },
    { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr' },
    { id: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' }
  ]);

  const localeIds = localeDefinitions.filter(({ id }) => id !== 'system').map(({ id }) => id);
  const rtlLocales = new Set(localeDefinitions.filter(({ dir }) => dir === 'rtl').map(({ id }) => id));
  const columns = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'fr', 'de', 'pt-BR', 'hi', 'ar'];

  // Source Japanese, then English, Simplified Chinese, Traditional Chinese, Korean,
  // Spanish, French, German, Brazilian Portuguese, Hindi and Arabic.
  const rows = [
    ['ホーム', 'Home', '主页', '首頁', '홈', 'Inicio', 'Accueil', 'Start', 'Início', 'होम', 'الرئيسية'],
    ['ミッション', 'Missions', '任务', '任務', '미션', 'Misiones', 'Missions', 'Missionen', 'Missões', 'मिशन', 'المهام'],
    ['プラン', 'Plan', '计划', '計畫', '플랜', 'Plan', 'Plan', 'Plan', 'Plano', 'योजना', 'الخطة'],
    ['集中', 'Focus', '专注', '專注', '집중', 'Concentración', 'Concentration', 'Fokus', 'Foco', 'फ़ोकस', 'التركيز'],
    ['ログ', 'Log', '日志', '日誌', '로그', 'Registro', 'Journal', 'Logbuch', 'Registro', 'लॉग', 'السجل'],
    ['ログブック', 'Logbook', '日志本', '日誌簿', '로그북', 'Diario', 'Journal', 'Logbuch', 'Diário', 'लॉगबुक', 'دفتر السجل'],
    ['連携', 'Connect', '连接', '連接', '연동', 'Conectar', 'Connexions', 'Dienste', 'Conectar', 'कनेक्ट', 'الربط'],
    ['サービス連携', 'Service connections', '服务连接', '服務連接', '서비스 연동', 'Conexiones de servicios', 'Connexions de services', 'Dienstverbindungen', 'Conexões de serviços', 'सेवा कनेक्शन', 'ربط الخدمات'],
    ['分析', 'Insights', '洞察', '洞察', '인사이트', 'Análisis', 'Analyses', 'Analysen', 'Análises', 'इनसाइट', 'التحليلات'],
    ['インサイト', 'Insights', '洞察', '洞察', '인사이트', 'Análisis', 'Analyses', 'Analysen', 'Análises', 'इनसाइट', 'التحليلات'],
    ['ミニ', 'Mini', '迷你', '迷你', '미니', 'Mini', 'Mini', 'Mini', 'Mini', 'मिनी', 'مصغر'],
    ['ミニモード', 'Mini mode', '迷你模式', '迷你模式', '미니 모드', 'Modo mini', 'Mode mini', 'Mini-Modus', 'Modo mini', 'मिनी मोड', 'الوضع المصغر'],
    ['設定', 'Settings', '设置', '設定', '설정', 'Ajustes', 'Paramètres', 'Einstellungen', 'Configurações', 'सेटिंग', 'الإعدادات'],
    ['コマンド', 'Command', '命令', '指令', '명령', 'Comando', 'Commande', 'Befehl', 'Comando', 'कमांड', 'الأوامر'],
    ['今日', 'Today', '今天', '今天', '오늘', 'Hoy', "Aujourd’hui", 'Heute', 'Hoje', 'आज', 'اليوم'],
    ['すべて', 'All', '全部', '全部', '전체', 'Todo', 'Tout', 'Alle', 'Tudo', 'सभी', 'الكل'],
    ['進行中', 'In progress', '进行中', '進行中', '진행 중', 'En curso', 'En cours', 'In Arbeit', 'Em andamento', 'प्रगति में', 'قيد التنفيذ'],
    ['完了', 'Completed', '已完成', '已完成', '완료', 'Completado', 'Terminé', 'Erledigt', 'Concluído', 'पूर्ण', 'مكتمل'],
    ['追加', 'Add', '添加', '新增', '추가', 'Añadir', 'Ajouter', 'Hinzufügen', 'Adicionar', 'जोड़ें', 'إضافة'],
    ['編集', 'Edit', '编辑', '編輯', '편집', 'Editar', 'Modifier', 'Bearbeiten', 'Editar', 'संपादित करें', 'تعديل'],
    ['削除', 'Delete', '删除', '刪除', '삭제', 'Eliminar', 'Supprimer', 'Löschen', 'Excluir', 'हटाएँ', 'حذف'],
    ['キャンセル', 'Cancel', '取消', '取消', '취소', 'Cancelar', 'Annuler', 'Abbrechen', 'Cancelar', 'रद्द करें', 'إلغاء'],
    ['閉じる', 'Close', '关闭', '關閉', '닫기', 'Cerrar', 'Fermer', 'Schließen', 'Fechar', 'बंद करें', 'إغلاق'],
    ['書き出す', 'Export', '导出', '匯出', '내보내기', 'Exportar', 'Exporter', 'Exportieren', 'Exportar', 'निर्यात करें', 'تصدير'],
    ['読み込む', 'Import', '导入', '匯入', '가져오기', 'Importar', 'Importer', 'Importieren', 'Importar', 'आयात करें', 'استيراد'],
    ['保存', 'Save', '保存', '儲存', '저장', 'Guardar', 'Enregistrer', 'Speichern', 'Salvar', 'सहेजें', 'حفظ'],
    ['次へ', 'Next', '下一步', '下一步', '다음', 'Siguiente', 'Suivant', 'Weiter', 'Próximo', 'अगला', 'التالي'],
    ['前の日', 'Previous day', '前一天', '前一天', '이전 날', 'Día anterior', 'Jour précédent', 'Vorheriger Tag', 'Dia anterior', 'पिछला दिन', 'اليوم السابق'],
    ['次の日', 'Next day', '后一天', '後一天', '다음 날', 'Día siguiente', 'Jour suivant', 'Nächster Tag', 'Próximo dia', 'अगला दिन', 'اليوم التالي'],
    ['今日に戻る', 'Back to today', '回到今天', '回到今天', '오늘로', 'Volver a hoy', "Revenir à aujourd’hui", 'Zu heute', 'Voltar para hoje', 'आज पर लौटें', 'العودة إلى اليوم'],
    ['言語', 'Language', '语言', '語言', '언어', 'Idioma', 'Langue', 'Sprache', 'Idioma', 'भाषा', 'اللغة'],
    ['表示言語', 'Display language', '显示语言', '顯示語言', '표시 언어', 'Idioma de la interfaz', "Langue d’affichage", 'Anzeigesprache', 'Idioma de exibição', 'प्रदर्शन भाषा', 'لغة العرض'],
    ['OSの言語を使用', 'Use system language', '使用系统语言', '使用系統語言', '시스템 언어 사용', 'Usar idioma del sistema', 'Utiliser la langue du système', 'Systemsprache verwenden', 'Usar idioma do sistema', 'सिस्टम भाषा का उपयोग करें', 'استخدام لغة النظام'],
    ['外観モード', 'Appearance', '外观模式', '外觀模式', '화면 모드', 'Apariencia', 'Apparence', 'Darstellung', 'Aparência', 'दिखावट', 'المظهر'],
    ['☀ ライト', '☀ Light', '☀ 浅色', '☀ 淺色', '☀ 라이트', '☀ Claro', '☀ Clair', '☀ Hell', '☀ Claro', '☀ हल्का', '☀ فاتح'],
    ['◐ ダーク', '◐ Dark', '◐ 深色', '◐ 深色', '◐ 다크', '◐ Oscuro', '◐ Sombre', '◐ Dunkel', '◐ Escuro', '◐ गहरा', '◐ داكن'],
    ['◉ システム', '◉ System', '◉ 系统', '◉ 系統', '◉ 시스템', '◉ Sistema', '◉ Système', '◉ System', '◉ Sistema', '◉ सिस्टम', '◉ النظام'],
    ['カラーテーマ', 'Color theme', '颜色主题', '色彩主題', '색상 테마', 'Tema de color', 'Thème de couleur', 'Farbthema', 'Tema de cores', 'रंग थीम', 'سمة الألوان'],
    ['カスタムアクセント', 'Custom accent', '自定义强调色', '自訂強調色', '사용자 강조색', 'Color personalizado', 'Couleur personnalisée', 'Eigene Akzentfarbe', 'Cor personalizada', 'कस्टम रंग', 'لون مخصص'],
    ['標準色へ戻す', 'Reset color', '恢复默认颜色', '重設為預設色彩', '기본 색상으로', 'Restablecer color', 'Réinitialiser la couleur', 'Farbe zurücksetzen', 'Redefinir cor', 'रंग रीसेट करें', 'إعادة تعيين اللون'],
    ['モーション', 'Motion', '动效', '動效', '모션', 'Movimiento', 'Mouvement', 'Bewegung', 'Movimento', 'मोशन', 'الحركة'],
    ['Windows通知', 'Windows notifications', 'Windows 通知', 'Windows 通知', 'Windows 알림', 'Notificaciones de Windows', 'Notifications Windows', 'Windows-Benachrichtigungen', 'Notificações do Windows', 'Windows सूचनाएँ', 'إشعارات Windows'],
    ['アニメーションを減らす', 'Reduce animations', '减少动画', '減少動畫', '애니메이션 줄이기', 'Reducir animaciones', 'Réduire les animations', 'Animationen reduzieren', 'Reduzir animações', 'एनीमेशन कम करें', 'تقليل الرسوم المتحركة'],
    ['閉じたときタスクトレイに残す', 'Keep in tray when closed', '关闭时保留在托盘', '關閉時保留在系統匣', '닫을 때 트레이에 유지', 'Mantener en la bandeja al cerrar', 'Conserver dans la zone de notification', 'Beim Schließen im Tray behalten', 'Manter na bandeja ao fechar', 'बंद होने पर ट्रे में रखें', 'الإبقاء في شريط النظام عند الإغلاق'],
    ['表示名', 'Display name', '显示名称', '顯示名稱', '표시 이름', 'Nombre para mostrar', "Nom d’affichage", 'Anzeigename', 'Nome de exibição', 'प्रदर्शन नाम', 'اسم العرض'],
    ['週間セッション目標', 'Weekly session goal', '每周专注目标', '每週專注目標', '주간 세션 목표', 'Objetivo semanal', 'Objectif hebdomadaire', 'Wöchentliches Sitzungsziel', 'Meta semanal', 'साप्ताहिक सत्र लक्ष्य', 'هدف الجلسات الأسبوعي'],
    ['カスタム集中時間（分）', 'Custom focus duration (minutes)', '自定义专注时长（分钟）', '自訂專注時間（分鐘）', '사용자 집중 시간(분)', 'Duración personalizada (minutos)', 'Durée personnalisée (minutes)', 'Eigene Fokusdauer (Minuten)', 'Duração personalizada (minutos)', 'कस्टम फ़ोकस अवधि (मिनट)', 'مدة التركيز المخصصة (بالدقائق)'],
    ['設定を保存', 'Save settings', '保存设置', '儲存設定', '설정 저장', 'Guardar ajustes', 'Enregistrer les paramètres', 'Einstellungen speichern', 'Salvar configurações', 'सेटिंग सहेजें', 'حفظ الإعدادات'],
    ['バックアップを書き出す', 'Export backup', '导出备份', '匯出備份', '백업 내보내기', 'Exportar copia', 'Exporter la sauvegarde', 'Sicherung exportieren', 'Exportar backup', 'बैकअप निर्यात करें', 'تصدير نسخة احتياطية'],
    ['バックアップを読み込む', 'Import backup', '导入备份', '匯入備份', '백업 가져오기', 'Importar copia', 'Importer la sauvegarde', 'Sicherung importieren', 'Importar backup', 'बैकअप आयात करें', 'استيراد نسخة احتياطية'],
    ['ミッション追加', 'Add mission', '添加任务', '新增任務', '미션 추가', 'Añadir misión', 'Ajouter une mission', 'Mission hinzufügen', 'Adicionar missão', 'मिशन जोड़ें', 'إضافة مهمة'],
    ['ミッションを追加', 'Add mission', '添加任务', '新增任務', '미션 추가', 'Añadir misión', 'Ajouter une mission', 'Mission hinzufügen', 'Adicionar missão', 'मिशन जोड़ें', 'إضافة مهمة'],
    ['ミッションを保存', 'Save mission', '保存任务', '儲存任務', '미션 저장', 'Guardar misión', 'Enregistrer la mission', 'Mission speichern', 'Salvar missão', 'मिशन सहेजें', 'حفظ المهمة'],
    ['ミッション名', 'Mission name', '任务名称', '任務名稱', '미션 이름', 'Nombre de la misión', 'Nom de la mission', 'Missionsname', 'Nome da missão', 'मिशन का नाम', 'اسم المهمة'],
    ['メモ', 'Notes', '备注', '備註', '메모', 'Notas', 'Notes', 'Notizen', 'Notas', 'नोट्स', 'ملاحظات'],
    ['優先度', 'Priority', '优先级', '優先順序', '우선순위', 'Prioridad', 'Priorité', 'Priorität', 'Prioridade', 'प्राथमिकता', 'الأولوية'],
    ['カテゴリー', 'Category', '类别', '類別', '카테고리', 'Categoría', 'Catégorie', 'Kategorie', 'Categoria', 'श्रेणी', 'الفئة'],
    ['期限', 'Due date', '截止日期', '截止日期', '마감일', 'Fecha límite', 'Échéance', 'Fälligkeitsdatum', 'Prazo', 'नियत तारीख', 'تاريخ الاستحقاق'],
    ['繰り返し', 'Repeat', '重复', '重複', '반복', 'Repetir', 'Répéter', 'Wiederholen', 'Repetir', 'दोहराएँ', 'التكرار'],
    ['推定所要時間', 'Estimated duration', '预计时长', '預估時間', '예상 소요 시간', 'Duración estimada', 'Durée estimée', 'Geschätzte Dauer', 'Duração estimada', 'अनुमानित अवधि', 'المدة المقدرة'],
    ['プロジェクト', 'Project', '项目', '專案', '프로젝트', 'Proyecto', 'Projet', 'Projekt', 'Projeto', 'प्रोजेक्ट', 'المشروع'],
    ['状態', 'Status', '状态', '狀態', '상태', 'Estado', 'État', 'Status', 'Status', 'स्थिति', 'الحالة'],
    ['サブタスク', 'Subtasks', '子任务', '子任務', '하위 작업', 'Subtareas', 'Sous-tâches', 'Unteraufgaben', 'Subtarefas', 'उपकार्य', 'المهام الفرعية'],
    ['プロジェクトなし', 'No project', '无项目', '無專案', '프로젝트 없음', 'Sin proyecto', 'Aucun projet', 'Kein Projekt', 'Sem projeto', 'कोई प्रोजेक्ट नहीं', 'بلا مشروع'],
    ['すべてのプロジェクト', 'All projects', '所有项目', '所有專案', '모든 프로젝트', 'Todos los proyectos', 'Tous les projets', 'Alle Projekte', 'Todos os projetos', 'सभी प्रोजेक्ट', 'كل المشاريع'],
    ['新しい順', 'Newest first', '最新优先', '最新優先', '최신순', 'Más recientes', 'Plus récentes', 'Neueste zuerst', 'Mais recentes', 'नवीनतम पहले', 'الأحدث أولاً'],
    ['期限順', 'Due date', '按截止日期', '依截止日期', '마감일순', 'Por fecha límite', 'Par échéance', 'Nach Fälligkeit', 'Por prazo', 'नियत तारीख', 'حسب الاستحقاق'],
    ['優先度順', 'Priority', '按优先级', '依優先順序', '우선순위순', 'Por prioridad', 'Par priorité', 'Nach Priorität', 'Por prioridade', 'प्राथमिकता', 'حسب الأولوية'],
    ['ボード表示', 'Board view', '看板视图', '看板檢視', '보드 보기', 'Vista de tablero', 'Vue tableau', 'Board-Ansicht', 'Visão em quadro', 'बोर्ड दृश्य', 'عرض اللوحة'],
    ['リスト表示', 'List view', '列表视图', '清單檢視', '목록 보기', 'Vista de lista', 'Vue liste', 'Listenansicht', 'Visão em lista', 'सूची दृश्य', 'عرض القائمة'],
    ['予定を追加', 'Add time block', '添加日程', '新增行程', '일정 추가', 'Añadir bloque', 'Ajouter un créneau', 'Zeitblock hinzufügen', 'Adicionar bloco', 'समय ब्लॉक जोड़ें', 'إضافة فترة زمنية'],
    ['予定を保存', 'Save time block', '保存日程', '儲存行程', '일정 저장', 'Guardar bloque', 'Enregistrer le créneau', 'Zeitblock speichern', 'Salvar bloco', 'समय ब्लॉक सहेजें', 'حفظ الفترة الزمنية'],
    ['予定の名前', 'Block name', '日程名称', '行程名稱', '일정 이름', 'Nombre del bloque', 'Nom du créneau', 'Name des Zeitblocks', 'Nome do bloco', 'ब्लॉक का नाम', 'اسم الفترة'],
    ['日付', 'Date', '日期', '日期', '날짜', 'Fecha', 'Date', 'Datum', 'Data', 'तारीख', 'التاريخ'],
    ['開始時刻', 'Start time', '开始时间', '開始時間', '시작 시간', 'Hora de inicio', 'Heure de début', 'Startzeit', 'Hora de início', 'आरंभ समय', 'وقت البدء'],
    ['長さ', 'Duration', '时长', '長度', '길이', 'Duración', 'Durée', 'Dauer', 'Duração', 'अवधि', 'المدة'],
    ['通知', 'Reminder', '提醒', '提醒', '알림', 'Recordatorio', 'Rappel', 'Erinnerung', 'Lembrete', 'रिमाइंडर', 'التذكير'],
    ['通知なし', 'No reminder', '无提醒', '無提醒', '알림 없음', 'Sin recordatorio', 'Aucun rappel', 'Keine Erinnerung', 'Sem lembrete', 'कोई रिमाइंडर नहीं', 'بلا تذكير'],
    ['関連付けない', 'Not linked', '不关联', '不關聯', '연결 안 함', 'Sin vincular', 'Non lié', 'Nicht verknüpft', 'Não vinculado', 'लिंक नहीं', 'غير مرتبط'],
    ['習慣を追加', 'Add habit', '添加习惯', '新增習慣', '습관 추가', 'Añadir hábito', 'Ajouter une habitude', 'Gewohnheit hinzufügen', 'Adicionar hábito', 'आदत जोड़ें', 'إضافة عادة'],
    ['習慣を保存', 'Save habit', '保存习惯', '儲存習慣', '습관 저장', 'Guardar hábito', "Enregistrer l’habitude", 'Gewohnheit speichern', 'Salvar hábito', 'आदत सहेजें', 'حفظ العادة'],
    ['習慣の名前', 'Habit name', '习惯名称', '習慣名稱', '습관 이름', 'Nombre del hábito', "Nom de l’habitude", 'Name der Gewohnheit', 'Nome do hábito', 'आदत का नाम', 'اسم العادة'],
    ['週間目標', 'Weekly goal', '每周目标', '每週目標', '주간 목표', 'Objetivo semanal', 'Objectif hebdomadaire', 'Wochenziel', 'Meta semanal', 'साप्ताहिक लक्ष्य', 'الهدف الأسبوعي'],
    ['集中セッション', 'Focus session', '专注时段', '專注時段', '집중 세션', 'Sesión de concentración', 'Session de concentration', 'Fokussitzung', 'Sessão de foco', 'फ़ोकस सत्र', 'جلسة تركيز'],
    ['準備完了', 'Ready', '准备就绪', '準備就緒', '준비 완료', 'Listo', 'Prêt', 'Bereit', 'Pronto', 'तैयार', 'جاهز'],
    ['一時停止中', 'Paused', '已暂停', '已暫停', '일시 정지', 'En pausa', 'En pause', 'Pausiert', 'Pausado', 'रुका हुआ', 'متوقف مؤقتًا'],
    ['ミッション未選択', 'No mission selected', '未选择任务', '未選擇任務', '미션 미선택', 'Ninguna misión seleccionada', 'Aucune mission sélectionnée', 'Keine Mission ausgewählt', 'Nenhuma missão selecionada', 'कोई मिशन नहीं चुना', 'لم يتم اختيار مهمة'],
    ['環境音', 'Soundscape', '环境音', '環境音', '환경음', 'Paisaje sonoro', 'Ambiance sonore', 'Klanglandschaft', 'Paisagem sonora', 'परिवेश ध्वनि', 'المشهد الصوتي'],
    ['思考を記録', 'Capture your thoughts', '记录想法', '記錄想法', '생각 기록', 'Captura tus ideas', 'Notez vos pensées', 'Gedanken festhalten', 'Registre seus pensamentos', 'विचार दर्ज करें', 'دوّن أفكارك'],
    ['すべて保存済み', 'All changes saved', '全部已保存', '全部已儲存', '모두 저장됨', 'Todo guardado', 'Tout est enregistré', 'Alles gespeichert', 'Tudo salvo', 'सब सहेजा गया', 'تم حفظ الكل'],
    ['保存中…', 'Saving…', '正在保存…', '正在儲存…', '저장 중…', 'Guardando…', 'Enregistrement…', 'Wird gespeichert…', 'Salvando…', 'सहेजा जा रहा है…', 'جارٍ الحفظ…'],
    ['ローカル自動化', 'Local automations', '本地自动化', '本機自動化', '로컬 자동화', 'Automatizaciones locales', 'Automatisations locales', 'Lokale Automationen', 'Automações locais', 'लोकल ऑटोमेशन', 'الأتمتة المحلية'],
    ['再利用テンプレート', 'Reusable templates', '可复用模板', '可重用範本', '재사용 템플릿', 'Plantillas reutilizables', 'Modèles réutilisables', 'Wiederverwendbare Vorlagen', 'Modelos reutilizáveis', 'पुन: उपयोग योग्य टेम्पलेट', 'قوالب قابلة لإعادة الاستخدام'],
    ['データ診断', 'Data diagnostics', '数据诊断', '資料診斷', '데이터 진단', 'Diagnóstico de datos', 'Diagnostic des données', 'Datendiagnose', 'Diagnóstico de dados', 'डेटा निदान', 'تشخيص البيانات'],
    ['今すぐスキャン', 'Scan now', '立即扫描', '立即掃描', '지금 스캔', 'Analizar ahora', 'Analyser maintenant', 'Jetzt prüfen', 'Verificar agora', 'अभी स्कैन करें', 'الفحص الآن'],
    ['実行履歴', 'Run history', '运行历史', '執行記錄', '실행 기록', 'Historial de ejecución', 'Historique des exécutions', 'Ausführungsverlauf', 'Histórico de execução', 'रन इतिहास', 'سجل التشغيل'],
    ['ルール名', 'Rule name', '规则名称', '規則名稱', '규칙 이름', 'Nombre de la regla', 'Nom de la règle', 'Regelname', 'Nome da regra', 'नियम का नाम', 'اسم القاعدة'],
    ['条件', 'Condition', '条件', '條件', '조건', 'Condición', 'Condition', 'Bedingung', 'Condição', 'शर्त', 'الشرط'],
    ['実行する処理', 'Action', '执行操作', '執行動作', '실행 작업', 'Acción', 'Action', 'Aktion', 'Ação', 'क्रिया', 'الإجراء'],
    ['ルールを保存', 'Save rule', '保存规则', '儲存規則', '규칙 저장', 'Guardar regla', 'Enregistrer la règle', 'Regel speichern', 'Salvar regra', 'नियम सहेजें', 'حفظ القاعدة'],
    ['テンプレート名', 'Template name', '模板名称', '範本名稱', '템플릿 이름', 'Nombre de la plantilla', 'Nom du modèle', 'Vorlagenname', 'Nome do modelo', 'टेम्पलेट का नाम', 'اسم القالب'],
    ['説明', 'Description', '说明', '說明', '설명', 'Descripción', 'Description', 'Beschreibung', 'Descrição', 'विवरण', 'الوصف'],
    ['テンプレートを保存', 'Save template', '保存模板', '儲存範本', '템플릿 저장', 'Guardar plantilla', 'Enregistrer le modèle', 'Vorlage speichern', 'Salvar modelo', 'टेम्पलेट सहेजें', 'حفظ القالب'],
    ['最近のデータ交換', 'Recent transfers', '最近的数据交换', '最近的資料交換', '최근 데이터 교환', 'Transferencias recientes', 'Transferts récents', 'Letzte Übertragungen', 'Transferências recentes', 'हाल के ट्रांसफ़र', 'عمليات النقل الأخيرة'],
    ['履歴を消去', 'Clear history', '清除历史', '清除記錄', '기록 지우기', 'Borrar historial', "Effacer l’historique", 'Verlauf löschen', 'Limpar histórico', 'इतिहास साफ़ करें', 'مسح السجل'],
    ['データを書き出す', 'Export data', '导出数据', '匯出資料', '데이터 내보내기', 'Exportar datos', 'Exporter les données', 'Daten exportieren', 'Exportar dados', 'डेटा निर्यात करें', 'تصدير البيانات'],
    ['データを読み込む', 'Import data', '导入数据', '匯入資料', '데이터 가져오기', 'Importar datos', 'Importer les données', 'Daten importieren', 'Importar dados', 'डेटा आयात करें', 'استيراد البيانات'],
    ['ファイル形式', 'File format', '文件格式', '檔案格式', '파일 형식', 'Formato de archivo', 'Format de fichier', 'Dateiformat', 'Formato de arquivo', 'फ़ाइल प्रारूप', 'تنسيق الملف'],
    ['ローカル処理', 'Local processing', '本地处理', '本機處理', '로컬 처리', 'Procesamiento local', 'Traitement local', 'Lokale Verarbeitung', 'Processamento local', 'लोकल प्रोसेसिंग', 'معالجة محلية'],
    ['データは外部サーバーを経由しません。', 'Your data never passes through an external server.', '数据不会经过外部服务器。', '資料不會經過外部伺服器。', '데이터는 외부 서버를 거치지 않습니다.', 'Tus datos no pasan por servidores externos.', 'Vos données ne transitent par aucun serveur externe.', 'Ihre Daten passieren keinen externen Server.', 'Seus dados não passam por servidores externos.', 'आपका डेटा किसी बाहरी सर्वर से नहीं गुजरता।', 'لا تمر بياناتك عبر أي خادم خارجي.'],
    ['安全なローカルファイル交換', 'Secure local file exchange', '安全的本地文件交换', '安全的本機檔案交換', '안전한 로컬 파일 교환', 'Intercambio local seguro', 'Échange local sécurisé', 'Sicherer lokaler Dateiaustausch', 'Troca local segura', 'सुरक्षित लोकल फ़ाइल एक्सचेंज', 'تبادل ملفات محلي وآمن'],
    ['あなたのデータは、あなたの手元から。', 'Your data stays with you.', '你的数据始终由你掌控。', '你的資料始終由你掌控。', '데이터는 언제나 내 곁에.', 'Tus datos se quedan contigo.', 'Vos données restent avec vous.', 'Ihre Daten bleiben bei Ihnen.', 'Seus dados ficam com você.', 'आपका डेटा आपके पास रहता है।', 'تبقى بياناتك لديك.'],
    ['おはようございます', 'Good morning', '早上好', '早安', '좋은 아침입니다', 'Buenos días', 'Bonjour', 'Guten Morgen', 'Bom dia', 'सुप्रभात', 'صباح الخير'],
    ['こんにちは', 'Hello', '你好', '你好', '안녕하세요', 'Hola', 'Bonjour', 'Hallo', 'Olá', 'नमस्ते', 'مرحبًا'],
    ['こんばんは', 'Good evening', '晚上好', '晚安', '좋은 저녁입니다', 'Buenas tardes', 'Bonsoir', 'Guten Abend', 'Boa noite', 'शुभ संध्या', 'مساء الخير'],
    ['夜更けですね', 'Still awake?', '夜深了', '夜深了', '늦은 시간이네요', '¿Aún despierto?', 'Encore éveillé ?', 'Noch wach?', 'Ainda acordado?', 'अभी भी जाग रहे हैं?', 'ما زلت مستيقظًا؟'],
    ['静かな集中が、大きな軌道をつくります。', 'Quiet focus creates a powerful trajectory.', '安静的专注，成就更大的轨迹。', '安靜的專注，成就更大的軌跡。', '고요한 집중이 큰 궤도를 만듭니다.', 'La concentración serena crea una gran trayectoria.', 'Une concentration sereine crée une grande trajectoire.', 'Ruhiger Fokus schafft eine starke Bahn.', 'O foco tranquilo cria uma grande trajetória.', 'शांत एकाग्रता बड़ी दिशा बनाती है।', 'التركيز الهادئ يصنع مسارًا عظيمًا.'],
    ['最初の一歩を記録しましょう。', 'Record the first small step.', '记录第一小步。', '記錄第一小步。', '첫걸음을 기록해 보세요.', 'Registra el primer paso.', 'Notez le premier pas.', 'Halte den ersten Schritt fest.', 'Registre o primeiro passo.', 'पहला छोटा कदम दर्ज करें।', 'سجّل الخطوة الأولى.'],
    ['すべてのミッションが完了しています', 'All missions are complete', '所有任务均已完成', '所有任務均已完成', '모든 미션 완료', 'Todas las misiones están completas', 'Toutes les missions sont terminées', 'Alle Missionen sind erledigt', 'Todas as missões foram concluídas', 'सभी मिशन पूरे हैं', 'اكتملت جميع المهام'],
    ['余白を楽しむか、次の軌道を計画しましょう。', 'Enjoy the space, or plan your next trajectory.', '享受留白，或规划下一条轨迹。', '享受留白，或規劃下一條軌跡。', '여유를 즐기거나 다음 궤도를 계획하세요.', 'Disfruta del espacio o planea tu próxima trayectoria.', 'Profitez de cet espace ou planifiez la suite.', 'Genieße den Freiraum oder plane deine nächste Bahn.', 'Aproveite o espaço ou planeje a próxima trajetória.', 'खाली समय का आनंद लें या अगली दिशा बनाएँ।', 'استمتع بالمساحة أو خطط لمسارك التالي.'],
    ['予定の開始時刻です。', 'The event is starting now.', '日程现在开始。', '行程現在開始。', '일정이 지금 시작됩니다.', 'El evento comienza ahora.', 'L’événement commence maintenant.', 'Der Termin beginnt jetzt.', 'O evento começa agora.', 'कार्यक्रम अब शुरू हो रहा है।', 'يبدأ الحدث الآن.'],
    ['集中セッションが完了しました。少し休みましょう。', 'Focus session complete. Take a short break.', '专注时段已完成。休息一下吧。', '專注時段已完成。稍微休息一下吧。', '집중 세션 완료. 잠시 쉬어 가세요.', 'Sesión completada. Tómate un descanso.', 'Session terminée. Faites une courte pause.', 'Fokussitzung beendet. Mach eine kurze Pause.', 'Sessão concluída. Faça uma pequena pausa.', 'फ़ोकस सत्र पूरा हुआ। थोड़ा विराम लें।', 'اكتملت جلسة التركيز. خذ استراحة قصيرة.'],
    ['休憩が終わりました。次のセッションを始められます。', 'Break complete. You can start the next session.', '休息结束。可以开始下一个时段。', '休息結束。可以開始下一個時段。', '휴식 완료. 다음 세션을 시작할 수 있습니다.', 'Descanso terminado. Puedes iniciar la siguiente sesión.', 'Pause terminée. Vous pouvez lancer la session suivante.', 'Pause beendet. Du kannst die nächste Sitzung starten.', 'Pausa concluída. Você pode iniciar a próxima sessão.', 'विराम पूरा हुआ। अगला सत्र शुरू कर सकते हैं।', 'انتهت الاستراحة. يمكنك بدء الجلسة التالية.'],
    ['ASTERIAを起動できませんでした', 'ASTERIA could not start', 'ASTERIA 无法启动', 'ASTERIA 無法啟動', 'ASTERIA를 시작할 수 없습니다', 'ASTERIA no pudo iniciarse', 'ASTERIA n’a pas pu démarrer', 'ASTERIA konnte nicht gestartet werden', 'Não foi possível iniciar o ASTERIA', 'ASTERIA शुरू नहीं हो सका', 'تعذر تشغيل ASTERIA'],
    ['最小化', 'Minimize', '最小化', '最小化', '최소화', 'Minimizar', 'Réduire', 'Minimieren', 'Minimizar', 'छोटा करें', 'تصغير'],
    ['最大化', 'Maximize', '最大化', '最大化', '최대화', 'Maximizar', 'Agrandir', 'Maximieren', 'Maximizar', 'बड़ा करें', 'تكبير'],
    ['メインナビゲーション', 'Main navigation', '主导航', '主導覽', '기본 탐색', 'Navegación principal', 'Navigation principale', 'Hauptnavigation', 'Navegação principal', 'मुख्य नेविगेशन', 'التنقل الرئيسي'],
    ['エネルギーレベル', 'Energy level', '能量水平', '能量等級', '에너지 수준', 'Nivel de energía', "Niveau d’énergie", 'Energieniveau', 'Nível de energia', 'ऊर्जा स्तर', 'مستوى الطاقة'],
    ['今日の意図', "Today's intention", '今日意图', '今日意圖', '오늘의 의도', 'Intención de hoy', "Intention du jour", 'Heutige Absicht', 'Intenção de hoje', 'आज का इरादा', 'نية اليوم'],
    ['コマンドまたはミッションを検索…', 'Search commands or missions…', '搜索命令或任务…', '搜尋指令或任務…', '명령 또는 미션 검색…', 'Buscar comandos o misiones…', 'Rechercher commandes ou missions…', 'Befehle oder Missionen suchen…', 'Buscar comandos ou missões…', 'कमांड या मिशन खोजें…', 'ابحث في الأوامر أو المهام…'],
    ['一致するコマンドがありません', 'No matching commands', '没有匹配的命令', '沒有相符的指令', '일치하는 명령 없음', 'No hay comandos coincidentes', 'Aucune commande correspondante', 'Keine passenden Befehle', 'Nenhum comando correspondente', 'कोई मिलता कमांड नहीं', 'لا توجد أوامر مطابقة']
  ];

  // Specialist and descriptive copy uses English as the deterministic fallback for
  // language packs that do not override it yet. This keeps every control usable while
  // native coverage grows without ever calling a translation service.
  const englishFallbackRows = [
    ['OSの言語を使用、または11言語から選択できます。', 'Use the system language or choose from eleven languages.'],
    ['EXPRESSIVE — 奥行きのある動き', 'EXPRESSIVE — Layered motion'],
    ['GENTLE — 控えめな動き', 'GENTLE — Subtle motion'],
    ['集中セッション完了と予定リマインダーを通知', 'Notify when focus sessions complete and plans are due'],
    ['動きを抑え、集中しやすい表示にします', 'Reduce movement for a calmer interface'],
    ['タイマーと予定通知をバックグラウンドで継続', 'Keep timers and reminders running in the background'],
    ['デイリープラン', 'Daily planner'],
    ['今日の予定', "Today's plan"],
    ['今日のミッション', "Today's missions"],
    ['今日の航路', "Today's direction"],
    ['今日の航行予定', "Today's trajectory"],
    ['今週の軌道', 'Weekly orbit'],
    ['このミッションに集中', 'Focus this mission'],
    ['すべてのミッションを見る', 'View all missions'],
    ['詳細を開く', 'Open details'],
    ['フォーカス', 'Focus'],
    ['フォーカスを開く', 'Open Focus'],
    ['ミッションを選択', 'Select a mission'],
    ['ミッションを選択（任意）', 'Select a mission (optional)'],
    ['関連ミッション（任意）', 'Linked mission (optional)'],
    ['プロジェクトを追加', 'Add project'],
    ['プロジェクトを保存', 'Save project'],
    ['プロジェクト名', 'Project name'],
    ['目的・説明', 'Purpose and description'],
    ['シグナルカラー', 'Signal color'],
    ['ミッション（1行につき1件）', 'Missions (one per line)'],
    ['テンプレートを作成', 'Create template'],
    ['自動化ルールを作成', 'Create automation rule'],
    ['新しいミッション', 'New mission'],
    ['新しい習慣', 'New habit'],
    ['予定', 'Plan'],
    ['繰り返さない', 'Do not repeat'],
    ['毎日', 'Daily'],
    ['平日のみ', 'Weekdays'],
    ['毎週', 'Weekly'],
    ['週3日', '3 days a week'],
    ['週5日', '5 days a week'],
    ['15分', '15 minutes'],
    ['25分', '25 minutes'],
    ['30分', '30 minutes'],
    ['45分', '45 minutes'],
    ['1時間', '1 hour'],
    ['1時間30分', '1 hour 30 minutes'],
    ['2時間', '2 hours'],
    ['5分前', '5 minutes before'],
    ['10分前', '10 minutes before'],
    ['15分前', '15 minutes before'],
    ['30分前', '30 minutes before'],
    ['HIGH — 最優先', 'HIGH — Highest priority'],
    ['MEDIUM — 通常', 'MEDIUM — Normal'],
    ['LOW — 余裕があれば', 'LOW — When possible'],
    ['BACKLOG — あとで', 'BACKLOG — Later'],
    ['NEXT — 次に行う', 'NEXT — Next action'],
    ['WAITING — 待機中', 'WAITING — On hold'],
    ['COMPLETE — 完了', 'COMPLETE — Done'],
    ['静かな雨', 'Quiet rain'],
    ['夜のカフェ', 'Night café'],
    ['深い宇宙', 'Deep space'],
    ['安定航行', 'Steady'],
    ['低速航行', 'Low energy'],
    ['ゆっくり', 'Gentle pace'],
    ['通常運転', 'Balanced'],
    ['フルパワー', 'Full power'],
    ['過去5週間', 'Past five weeks'],
    ['過去7日間の集中時間', 'Focus time over seven days'],
    ['今日のセッション', "Today's sessions"],
    ['ミッション分布', 'Mission distribution'],
    ['記録は評価ではなく、よりよく進むための地図。', 'Your history is a map for moving forward, not a score.'],
    ['考えを言葉にすると、進む方向が見えてくる。', 'Putting thoughts into words reveals the next direction.'],
    ['時間を閉じ、ひとつのことだけを開く。', 'Close everything but the work in front of you.'],
    ['時間と習慣に、無理のない軌道を与える。', 'Give plans and habits a sustainable trajectory.'],
    ['プロジェクトから次の一手まで、ひとつの軌道に。', 'Bring projects and next actions into one trajectory.'],
    ['今日の状態から、無理のない行動を提案します。', 'Suggestions adapt to your energy and current workload.'],
    ['所要時間をもとに、優先ミッションを空き枠へ配置できます。', 'Place priority missions into open time based on duration.'],
    ['今日の時間に余白があります', 'There is open time today'],
    ['次の一手を解析中', 'Finding your next action'],
    ['今日の軌道は整理されています', "Today's trajectory is organized"],
    ['すべての進行中ミッションに時間の居場所があります。', 'Every active mission has a place in time.'],
    ['今日の軌道をすべて完了しました。', "Today's trajectory is complete."],
    ['いい軌道です。あと少しだけ。', 'Good trajectory. Just a little further.'],
    ['小さな前進が記録されています。', 'A small step forward has been recorded.'],
    ['プレビューがここに表示されます。', 'Preview appears here.'],
    ['習慣トラッカー', 'Habit tracker'],
    ['あなたの軌道を、静かに整える。', 'Quietly organize your trajectory.'],
    ['自動化、テンプレート、診断を、すべて端末内で安全に。', 'Automations, templates and diagnostics—securely on your device.'],
    ['ワークスペース知能', 'Workspace intelligence'],
    ['予測可能なローカル処理', 'Predictable local processing'],
    ['自由なスクリプトは実行せず、上記の条件と処理だけを適用します。', 'No arbitrary scripts are run. Only the visible condition and action are applied.'],
    ['クラウド送信もスクリプト実行もせず、許可したルールだけをローカルデータへ適用します。', 'Only approved rules touch local data. Nothing is uploaded and no scripts are executed.'],
    ['条件と処理が一致したミッションだけを更新します。', 'Only missions matching both the condition and action are updated.'],
    ['初期ルールはすべて停止しています', 'All built-in rules are disabled by default'],
    ['実行履歴はまだありません', 'No runs yet'],
    ['ルールは手動実行、または有効化後の起動時に動きます。', 'Rules run manually or at startup after you enable them.'],
    ['スキャン待機中', 'Ready to scan'],
    ['「健全性スキャン」でデータを検査します。', 'Use Health Scan to inspect your workspace.'],
    ['ワークスペースは健全です', 'Workspace is healthy'],
    ['重複、壊れた参照、予定の重なりは見つかりませんでした。', 'No duplicates, broken references or schedule conflicts were found.'],
    ['リアルタイムのプレビュー。結果を保存するにはスキャンしてください。', 'Live preview. Run a scan to save the result.'],
    ['安全に修復', 'Repair safely'],
    ['データベースはCSV、ログブックはMarkdownで共有できます。', 'Share databases as CSV and logs as Markdown.'],
    ['標準iCalendarファイルで予定を交換します。', 'Exchange events using standard iCalendar files.'],
    ['予定をICS / Google形式CSVで受け渡します。', 'Exchange plans using ICS or Google Calendar CSV.'],
    ['優先度、期限、所要時間を公式CSV列へ変換します。', 'Map priority, due date and duration to official CSV columns.'],
    ['ボードのJSON / CSVからカードとチェックリストを取り込みます。', 'Import cards and checklists from board JSON or CSV.'],
    ['UTF-8 CSVでミッションを表計算ソフトと交換します。', 'Exchange missions with spreadsheets through UTF-8 CSV.'],
    ['Google Calendar、Outlook、Todoist、Notion、Trello、Excelへ、ICS・CSV・JSON・Markdownで接続します。', 'Connect to Google Calendar, Outlook, Todoist, Notion, Trello and Excel through ICS, CSV, JSON and Markdown.'],
    ['認証情報を保存せず、標準ファイルでデータを安全に行き来させます。', 'Move data through standard files without storing credentials.'],
    ['ASTERIA完全バックアップ（JSON）', 'Complete ASTERIA backup (JSON)'],
    ['汎用タスク（CSV）', 'Generic tasks (CSV)'],
    ['Todoistプロジェクト（CSV）', 'Todoist project (CSV)'],
    ['カレンダー（ICS）', 'Calendar (ICS)'],
    ['ログブック（Markdown）', 'Logbook (Markdown)'],
    ['CSV出力', 'Export CSV'],
    ['ファイルを選択', 'Choose file'],
    ['解析中…', 'Analyzing…'],
    ['作成中…', 'Creating…'],
    ['完了にする', 'Mark complete'],
    ['未完了に戻す', 'Mark incomplete'],
    ['集中する', 'Focus'],
    ['期限を1日延ばす', 'Move due date one day'],
    ['前の状態へ', 'Previous status'],
    ['次の状態へ', 'Next status'],
    ['完了を切り替える', 'Toggle completion'],
    ['ミニモードを終了', 'Exit mini mode'],
    ['プロジェクトで絞り込む', 'Filter by project'],
    ['ミッションを検索', 'Search missions'],
    ['並び順', 'Sort order'],
    ['表示する日付', 'Displayed date'],
    ['予定を開く', 'Open planner'],
    ['習慣を追加', 'Add habit'],
    ['集中するミッション', 'Mission to focus'],
    ['クイックノート', 'Quick note'],
    ['いま考えていることを書き留める…', 'Capture what is on your mind…'],
    ['完了条件や、次の一手を書いておく', 'Describe the result or next action'],
    ['小さな完了条件を追加', 'Add a small completion step'],
    ['このプロジェクトで実現したいこと', 'What this project should achieve'],
    ['このテンプレートの目的', 'Purpose of this template'],
    ['例：企画書の最初の1ページを書く', 'Example: Draft the first page of the proposal'],
    ['例：企画書に集中する', 'Example: Focus on the proposal'],
    ['例：新製品ローンチ', 'Example: Product launch'],
    ['例：本を10ページ読む', 'Example: Read ten pages'],
    ['例：未分類を今日の予定へ', "Example: Move unclassified work into today's plan"],
    ['例：月次レポート', 'Example: Monthly report']
  ];

  const dictionaries = Object.fromEntries(columns.map((locale) => [locale, new Map()]));
  rows.forEach((row) => columns.forEach((locale, index) => dictionaries[locale].set(row[0], row[index] || row[1] || row[0])));
  englishFallbackRows.forEach(([source, fallback]) => columns.forEach((locale) => {
    if (!dictionaries[locale].has(source)) dictionaries[locale].set(source, locale === 'ja' ? source : fallback);
  }));

  let selectedLocale = 'system';
  let activeLocale = 'ja';
  let observer = null;
  let observedRoot = null;
  let applying = false;
  const textMemory = new WeakMap();
  const attributeMemory = new WeakMap();
  const translatedAttributes = ['aria-label', 'placeholder', 'title', 'data-tooltip'];

  function normalizeLocale(value) {
    const candidate = String(value || '').trim();
    if (localeDefinitions.some(({ id }) => id === candidate)) return candidate;
    const lowered = candidate.toLowerCase();
    if (lowered.startsWith('zh-tw') || lowered.startsWith('zh-hk') || lowered.startsWith('zh-hant')) return 'zh-TW';
    if (lowered.startsWith('zh')) return 'zh-CN';
    if (lowered.startsWith('pt')) return 'pt-BR';
    const base = lowered.split('-')[0];
    return localeIds.find((id) => id.toLowerCase() === base) || 'en';
  }

  function systemLocale(languages) {
    const values = Array.isArray(languages) && languages.length ? languages : [globalThis.navigator?.language || 'en'];
    for (const value of values) {
      const normalized = normalizeLocale(value);
      if (localeIds.includes(normalized)) return normalized;
    }
    return 'en';
  }

  function resolveLocale(value) {
    const normalized = normalizeLocale(value);
    return normalized === 'system' ? systemLocale(globalThis.navigator?.languages) : normalized;
  }

  function translateTemplate(source, locale = activeLocale) {
    if (locale === 'ja') return source;
    const dictionary = dictionaries[locale] || dictionaries.en;
    if (dictionary.has(source)) return dictionary.get(source);
    if (dictionaries.en.has(source)) return dictionaries.en.get(source);

    let match = source.match(/^(\d+)文字$/);
    if (match) return new Intl.NumberFormat(locale).format(Number(match[1])) + ({ en: ' characters', 'zh-CN': ' 个字符', 'zh-TW': ' 個字元', ko: '자', es: ' caracteres', fr: ' caractères', de: ' Zeichen', 'pt-BR': ' caracteres', hi: ' अक्षर', ar: ' حرفًا' }[locale] || ' characters');
    match = source.match(/^(\d+)文字 · (\d+)行$/);
    if (match) {
      const number = new Intl.NumberFormat(locale);
      const labels = { en: [' characters', ' lines'], 'zh-CN': [' 个字符', ' 行'], 'zh-TW': [' 個字元', ' 行'], ko: ['자', '줄'], es: [' caracteres', ' líneas'], fr: [' caractères', ' lignes'], de: [' Zeichen', ' Zeilen'], 'pt-BR': [' caracteres', ' linhas'], hi: [' अक्षर', ' पंक्तियाँ'], ar: [' حرفًا', ' سطرًا'] }[locale] || [' characters', ' lines'];
      return `${number.format(Number(match[1]))}${labels[0]} · ${number.format(Number(match[2]))}${labels[1]}`;
    }
    match = source.match(/^(\d+)件更新$/);
    if (match) return new Intl.NumberFormat(locale).format(Number(match[1])) + ({ en: ' updated', 'zh-CN': ' 项已更新', 'zh-TW': ' 項已更新', ko: '개 업데이트', es: ' actualizados', fr: ' mis à jour', de: ' aktualisiert', 'pt-BR': ' atualizados', hi: ' अपडेट', ar: ' محدّث' }[locale] || ' updated');
    match = source.match(/^(\d+)分後に予定が始まります。$/);
    if (match) return ({ en: `The event starts in ${match[1]} minutes.`, 'zh-CN': `日程将在 ${match[1]} 分钟后开始。`, 'zh-TW': `行程將在 ${match[1]} 分鐘後開始。`, ko: `${match[1]}분 후 일정이 시작됩니다.`, es: `El evento comienza en ${match[1]} minutos.`, fr: `L’événement commence dans ${match[1]} minutes.`, de: `Der Termin beginnt in ${match[1]} Minuten.`, 'pt-BR': `O evento começa em ${match[1]} minutos.`, hi: `कार्यक्रम ${match[1]} मिनट में शुरू होगा।`, ar: `يبدأ الحدث خلال ${match[1]} دقيقة.` }[locale] || `The event starts in ${match[1]} minutes.`);
    return source;
  }

  function t(source, values = null) {
    let result = translateTemplate(String(source ?? ''), activeLocale);
    if (values && typeof values === 'object') {
      Object.entries(values).forEach(([key, value]) => { result = result.replaceAll(`{${key}}`, String(value)); });
    }
    return result;
  }

  function translateTextNode(node) {
    if (!node?.parentElement || node.parentElement.closest('script, style, code, pre, [data-i18n-skip]')) return;
    const current = node.nodeValue;
    let memory = textMemory.get(node);
    if (!memory || current !== memory.rendered) memory = { source: current, rendered: current };
    const leading = memory.source.match(/^\s*/)?.[0] || '';
    const trailing = memory.source.match(/\s*$/)?.[0] || '';
    const core = memory.source.slice(leading.length, memory.source.length - trailing.length);
    const rendered = core ? `${leading}${t(core)}${trailing}` : memory.source;
    textMemory.set(node, { source: memory.source, rendered });
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }

  function translateElementAttributes(element) {
    if (!element?.getAttribute || element.closest('[data-i18n-skip]')) return;
    let memory = attributeMemory.get(element) || {};
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute);
      const entry = memory[attribute];
      const source = !entry || current !== entry.rendered ? current : entry.source;
      const rendered = t(source);
      memory[attribute] = { source, rendered };
      if (current !== rendered) element.setAttribute(attribute, rendered);
    });
    attributeMemory.set(element, memory);
  }

  function localize(root = observedRoot || globalThis.document?.body) {
    if (!root || applying) return;
    applying = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    if (root.nodeType === Node.TEXT_NODE) translateTextNode(root);
    else {
      translateElementAttributes(root);
      root.querySelectorAll?.('*').forEach(translateElementAttributes);
    }
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    applying = false;
  }

  function updateDocumentLanguage() {
    if (!globalThis.document) return;
    document.documentElement.lang = activeLocale;
    document.documentElement.dir = rtlLocales.has(activeLocale) ? 'rtl' : 'ltr';
    document.body?.setAttribute('data-locale', activeLocale);
    document.body?.setAttribute('data-direction', rtlLocales.has(activeLocale) ? 'rtl' : 'ltr');
  }

  function setLocale(value) {
    selectedLocale = normalizeLocale(value);
    activeLocale = resolveLocale(selectedLocale);
    updateDocumentLanguage();
    localize();
    globalThis.dispatchEvent?.(new CustomEvent('asteria:localechange', { detail: { selected: selectedLocale, locale: activeLocale } }));
    return activeLocale;
  }

  function start(value = 'system', root = globalThis.document?.body) {
    observedRoot = root;
    setLocale(value);
    observer?.disconnect();
    if (root && globalThis.MutationObserver) {
      observer = new MutationObserver((mutations) => {
        if (applying) return;
        mutations.forEach((mutation) => {
          if (mutation.type === 'characterData') translateTextNode(mutation.target);
          else if (mutation.type === 'attributes') translateElementAttributes(mutation.target);
          else mutation.addedNodes.forEach((node) => localize(node));
        });
      });
      observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    }
    return activeLocale;
  }

  function formatDate(value, options) {
    return new Intl.DateTimeFormat(activeLocale, options).format(value instanceof Date ? value : new Date(value));
  }

  function formatNumber(value, options) {
    return new Intl.NumberFormat(activeLocale, options).format(value);
  }

  const api = Object.freeze({
    localeDefinitions,
    supportedLocales: localeIds,
    normalizeLocale,
    resolveLocale,
    systemLocale,
    start,
    setLocale,
    localize,
    t,
    formatDate,
    formatNumber,
    currentLocale: () => activeLocale,
    selectedLocale: () => selectedLocale,
    isRtl: () => rtlLocales.has(activeLocale)
  });

  globalThis.AsteriaI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
