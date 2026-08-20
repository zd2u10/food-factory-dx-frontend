import { useState } from 'react';

/**
 * タブレットでの操作を想定した、大きなボタンで数値を入力するダイヤルパッド。
 * キーボードでの細かいタイプ操作の代わりに、ボタンをタップして数字を組み立てていく。
 *
 * props:
 *   value    : 現在の入力値(文字列。"" は未入力)
 *   onChange : ボタン操作のたびに呼ばれ、新しい値を渡す
 *   unit     : 単位の表示(例: "g")
 */
export default function DialPad({ value, onChange, unit }) {
  function pressDigit(digit) {
    // 先頭の "0" が残ったまま次の数字を打つと "05" のようになってしまうのを防ぐ。
    if (value === '0') {
      onChange(digit);
    } else {
      onChange(value + digit);
    }
  }

  function pressDecimalPoint() {
    // 既に小数点が入っている場合は、2つ目を追加しない。
    if (!value.includes('.')) {
      onChange(value === '' ? '0.' : value + '.');
    }
  }

  function pressBackspace() {
    onChange(value.slice(0, -1));
  }

  function pressClear() {
    onChange('');
  }

  // ボタンを並べる順番。3列×4行のいわゆる電卓配列。
  const rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', '⌫'],
  ];

  return (
    <div>
      {/* 現在の入力値を大きく表示する部分。タブレットでも遠目から見えるサイズにしている。 */}
      <div className="bg-white border rounded p-3 mb-3 text-end">
        <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value || '0'}</span>
        {unit && <span className="ms-2 text-muted fs-5">{unit}</span>}
      </div>

      <div className="d-grid gap-2">
        {rows.map((row, rowIndex) => (
          <div className="d-flex gap-2" key={rowIndex}>
            {row.map((key) => (
              <button
                key={key}
                type="button"
                className="btn btn-outline-secondary flex-grow-1 py-3"
                style={{ fontSize: '1.5rem' }}
                onClick={() => {
                  if (key === '.') pressDecimalPoint();
                  else if (key === '⌫') pressBackspace();
                  else pressDigit(key);
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="btn btn-outline-danger py-2" onClick={pressClear}>
          クリア
        </button>
      </div>
    </div>
  );
}

/**
 * DialPadを「入力欄+ボタンで開閉するパネル」の形にまとめたラッパー。
 * 通常は数値だけを表示しておき、タップするとダイヤルパッドが展開する。
 * (画面上に常時ダイヤルパッドを表示すると場所を取りすぎるため、
 *  必要な項目だけ展開する省スペースな作りにしている)
 *
 * placeholderValue: システムが計算した理論値。実測値が未入力の間、
 *   通常のinput要素のplaceholder属性と同じ考え方で、薄い色でこの値を表示する。
 *   人が実際に入力した値(value)がある場合は、そちらを優先して表示する。
 *   要件定義書5.1節「作業員が実測値を入力(システムの計算値はプレースホルダーとして表示)」に対応。
 */
export function DialPadField({ label, value, onChange, unit, placeholderValue }) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== '' && value !== undefined && value !== null;

  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <button
        type="button"
        className="btn btn-outline-primary w-100 py-2 text-end"
        style={{ fontSize: '1.25rem' }}
        onClick={() => setOpen((prev) => !prev)}
      >
        {hasValue ? (
          <span>
            {value} {unit}
          </span>
        ) : placeholderValue !== undefined ? (
          <span className="text-muted">
            {placeholderValue} {unit}
          </span>
        ) : (
          <span className="text-muted">
            0 {unit}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2">
          <DialPad value={value} onChange={onChange} unit={unit} />
        </div>
      )}
    </div>
  );
}
