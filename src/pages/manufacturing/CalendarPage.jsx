import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listBatches, runMrp } from '../../api/manufacturingApi.js';

// カレンダーの集計に使う状態の分類。
// 「準備中」: これから対応が必要なもの(DRAFT/PLAN)
// 「進行済み」: 既に材料を消費して動き出した、または完了したもの(MANUFACTURING/COMPLETED)
// REJECTED/CANCELLEDは、結局実施されなかった/失敗したものなので、どちらにも含めない。
const PREPARING_STATUSES = ['DRAFT', 'PLAN'];
const IN_PROGRESS_STATUSES = ['MANUFACTURING', 'COMPLETED'];

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 製造カレンダー。月表示で、各日付のマスに「準備中/進行済み/合計」の件数を表示する。
 * 日付をクリックすると、その日のデイリー画面(DailyManufacturingPage)へ遷移する。
 * 見た目はGoogleカレンダーの月表示を参考にしている(曜日の色分け、今日のマスの強調、
 * Todayボタンでの即時復帰など)。
 *
 * 【設計意図】DRAFT/PLANを「これから準備すべきもの」として目立たせ、
 * PLANからMANUFACTURINGに進んだバッチは"対応済み"という扱いになるため、
 * カレンダーの主役表示(準備中件数)からは自然と外れていく。
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() }; // month: 0-indexed
  });

  const queryClient = useQueryClient();
  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: listBatches });

  const mrpMutation = useMutation({
    mutationFn: runMrp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });

  // 日付文字列(YYYY-MM-DD) → その日の集計、のマップを作る。
  const summaryByDate = {};
  batches.forEach((batch) => {
    if (!summaryByDate[batch.batchDate]) {
      summaryByDate[batch.batchDate] = { preparing: 0, inProgress: 0 };
    }
    if (PREPARING_STATUSES.includes(batch.status)) {
      summaryByDate[batch.batchDate].preparing += 1;
    } else if (IN_PROGRESS_STATUSES.includes(batch.status)) {
      summaryByDate[batch.batchDate].inProgress += 1;
    }
  });

  const firstDayOfMonth = new Date(viewDate.year, viewDate.month, 1);
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay(); // 0=日曜

  // 前月・翌月の日付も、Googleカレンダーのように薄く埋めて、常に6週間分のマス目にする
  // (月によってマスの行数が変わると、レイアウトがガタつくため)。
  const prevMonthLastDate = new Date(viewDate.year, viewDate.month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDate - i, inCurrentMonth: false, dateStr: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, inCurrentMonth: true, dateStr });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ day: nextDay, inCurrentMonth: false, dateStr: null });
    nextDay += 1;
  }

  function changeMonth(diff) {
    setViewDate((prev) => {
      const newMonth = prev.month + diff;
      const newDate = new Date(prev.year, newMonth, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
  }

  function goToday() {
    const today = new Date();
    setViewDate({ year: today.getFullYear(), month: today.getMonth() });
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">製造カレンダー</h1>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => mrpMutation.mutate()}
          disabled={mrpMutation.isPending}
        >
          {mrpMutation.isPending ? '実行中...' : 'MRPを実行する(全商品)'}
        </button>
        {/* Draft一覧は、あくまで「今どんなDraftがあるか」を眺めるための画面。
            操作(PLAN確定・キャンセルなど)は、日付をクリックしてデイリー画面から行う。 */}
        <Link to="/manufacturing/drafts" className="text-muted small">
          Draft一覧を見る
        </Link>
      </div>
      {mrpMutation.isSuccess && (
        <div className="alert alert-success">
          MRPを実行しました({mrpMutation.data?.length ?? 0}件のバッチが生成されました)。
        </div>
      )}

      {/* ヘッダー部分。Googleカレンダーのように、暗めの背景色を敷いた帯の中に、
          Todayボタン・「< 年月 >」の配置でまとめる。 */}
      <div
        className="d-flex align-items-center justify-content-between mb-4 px-3 py-2 rounded"
        style={{ backgroundColor: '#202124' }}
      >
        <button type="button" className="btn btn-outline-light btn-sm" onClick={goToday}>
          Today
        </button>
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={() => changeMonth(-1)}
            aria-label="前月"
          >
            ‹
          </button>
          <h2 className="h5 mb-0 text-white">
            {viewDate.year}年 {viewDate.month + 1}月
          </h2>
          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={() => changeMonth(1)}
            aria-label="翌月"
          >
            ›
          </button>
        </div>
        <div style={{ width: '70px' }} /> {/* Todayボタンと釣り合いを取るための空白。中央の年月表記を真ん中に保つ */}
      </div>

      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : (
        <div>
          {/* 曜日の見出し行。日曜=赤、土曜=青で色分けする(Googleカレンダーの慣例に合わせる)。 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="mb-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className="text-center small fw-bold py-2"
                style={{ color: i === 0 ? '#dc3545' : i === 6 ? '#0d6efd' : '#6c757d' }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 各日付を、隣接させず独立したブロックとして表示する(gapで隙間を作る)。
              誤タップを防ぎたいという要望に基づき、あえてマス目同士を密着させていない。 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {cells.map((cell, index) => {
              const weekday = index % 7;
              const isToday = cell.dateStr === todayStr;
              const summary = cell.dateStr ? summaryByDate[cell.dateStr] ?? { preparing: 0, inProgress: 0 } : null;
              const total = summary ? summary.preparing + summary.inProgress : 0;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!cell.inCurrentMonth}
                  className="btn text-start p-3 rounded"
                  style={{
                    minHeight: '130px',
                    border: isToday ? '2px solid #1a73e8' : '1px solid #dee2e6',
                    backgroundColor: isToday ? '#e8f0fe' : cell.inCurrentMonth ? '#fff' : '#f8f9fa',
                    opacity: cell.inCurrentMonth ? 1 : 0.5,
                  }}
                  onClick={() => cell.dateStr && navigate(`/manufacturing/daily/${cell.dateStr}`)}
                >
                  <div
                    className="small"
                    style={{
                      color: !cell.inCurrentMonth
                        ? '#adb5bd'
                        : weekday === 0
                          ? '#dc3545'
                          : weekday === 6
                            ? '#0d6efd'
                            : '#212529',
                    }}
                  >
                    {isToday ? (
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle text-white fw-bold"
                        style={{ width: '24px', height: '24px', backgroundColor: '#1a73e8' }}
                      >
                        {cell.day}
                      </span>
                    ) : (
                      <span className="fw-bold">{cell.day}</span>
                    )}
                  </div>
                  {total > 0 && (
                    <div className="small mt-1">
                      {summary.preparing > 0 && (
                        <div className="text-primary">準備中 {summary.preparing}件</div>
                      )}
                      {summary.inProgress > 0 && (
                        <div className="text-muted">進行済み {summary.inProgress}件</div>
                      )}
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        合計 {total}件
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
