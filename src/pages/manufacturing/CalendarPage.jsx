import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listBatches } from '../../api/manufacturingApi.js';

// カレンダーの集計に使う状態の分類。
// 「準備中」: これから対応が必要なもの(DRAFT/PLAN)
// 「進行済み」: 既に材料を消費して動き出した、または完了したもの(MANUFACTURING/COMPLETED)
// REJECTED/CANCELLEDは、結局実施されなかった/失敗したものなので、どちらにも含めない。
const PREPARING_STATUSES = ['DRAFT', 'PLAN'];
const IN_PROGRESS_STATUSES = ['MANUFACTURING', 'COMPLETED'];

/**
 * 製造カレンダー。月表示で、各日付のマスに「準備中/進行済み/合計」の件数を表示する。
 * 日付をクリックすると、その日のデイリー画面(DailyManufacturingPage)へ遷移する。
 *
 * 【設計意図】DRAFT/PLANを「これから準備すべきもの」として目立たせ、
 * PLANからMANUFACTURINGに進んだバッチは"対応済み"という扱いになるため、
 * カレンダーの主役表示(準備中件数)からは自然と外れていく。
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() }; // month: 0-indexed
  });

  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: listBatches });

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

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(null); // 月初までの空白マス
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  function changeMonth(diff) {
    setViewDate((prev) => {
      const newMonth = prev.month + diff;
      const newDate = new Date(prev.year, newMonth, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">製造カレンダー</h1>

      <div className="mb-3">
        <Link to="/manufacturing/tabs" className="btn btn-secondary">
          Draft一覧・MRPなど、一括操作はこちら
        </Link>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <button type="button" className="btn btn-secondary" onClick={() => changeMonth(-1)}>
          ← 前月
        </button>
        <h2 className="h5 mb-0">
          {viewDate.year}年 {viewDate.month + 1}月
        </h2>
        <button type="button" className="btn btn-secondary" onClick={() => changeMonth(1)}>
          翌月 →
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
            <div key={w} className="text-center fw-bold small text-muted py-1">
              {w}
            </div>
          ))}
          {cells.map((dateStr, index) => {
            if (!dateStr) {
              return <div key={`empty-${index}`} style={{ minHeight: '90px' }} />;
            }
            const summary = summaryByDate[dateStr] ?? { preparing: 0, inProgress: 0 };
            const total = summary.preparing + summary.inProgress;
            const day = Number(dateStr.split('-')[2]);
            const isToday = dateStr === new Date().toISOString().slice(0, 10);

            return (
              <button
                key={dateStr}
                type="button"
                className={`btn text-start p-2 ${isToday ? 'border border-primary border-2' : 'border'}`}
                style={{ minHeight: '90px' }}
                onClick={() => navigate(`/manufacturing/daily/${dateStr}`)}
              >
                <div className="fw-bold">{day}</div>
                {total > 0 && (
                  <div className="small mt-1">
                    {summary.preparing > 0 && (
                      <div className="text-primary">準備中: {summary.preparing}件</div>
                    )}
                    {summary.inProgress > 0 && (
                      <div className="text-muted">進行済み: {summary.inProgress}件</div>
                    )}
                    <div className="text-muted">合計: {total}件</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
