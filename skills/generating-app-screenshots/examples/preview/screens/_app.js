// Tiny i18n for the demo mock screens: ?locale=xx picks the dictionary.
const L = new URLSearchParams(location.search).get('locale') || 'en-US';
const lang = L.split('-')[0];
const T = {
  en: { today: 'Today', streak: 'day streak', water: 'Drink water', read: 'Read 20 pages', run: 'Morning run', med: 'Meditate', done: 'done', week: 'This week', stats: 'Insights', best: 'Best streak', rate: 'Completion', remind: 'Reminders', at: 'at' },
  vi: { today: 'Hôm nay', streak: 'ngày liên tiếp', water: 'Uống nước', read: 'Đọc 20 trang', run: 'Chạy bộ buổi sáng', med: 'Thiền', done: 'xong', week: 'Tuần này', stats: 'Thống kê', best: 'Chuỗi dài nhất', rate: 'Hoàn thành', remind: 'Nhắc nhở', at: 'lúc' },
  de: { today: 'Heute', streak: 'Tage in Folge', water: 'Wasser trinken', read: '20 Seiten lesen', run: 'Morgenlauf', med: 'Meditieren', done: 'erledigt', week: 'Diese Woche', stats: 'Statistiken', best: 'Längste Serie', rate: 'Abschlussrate', remind: 'Erinnerungen', at: 'um' },
  ar: { today: 'اليوم', streak: 'يوم متتالي', water: 'اشرب الماء', read: 'اقرأ 20 صفحة', run: 'جري الصباح', med: 'تأمل', done: 'تم', week: 'هذا الأسبوع', stats: 'إحصاءات', best: 'أطول سلسلة', rate: 'الإنجاز', remind: 'التذكيرات', at: 'الساعة' },
  ja: { today: '今日', streak: '日連続', water: '水を飲む', read: '20ページ読む', run: '朝のランニング', med: '瞑想', done: '完了', week: '今週', stats: '統計', best: '最長記録', rate: '達成率', remind: 'リマインダー', at: '' },
};
const t = (k) => (T[lang] || T.en)[k];
document.documentElement.lang = L;
if (['ar', 'he'].includes(lang)) document.documentElement.dir = 'rtl';
document.querySelectorAll('[data-t]').forEach((e) => (e.textContent = t(e.dataset.t)));
