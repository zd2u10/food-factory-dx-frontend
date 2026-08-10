// バックエンド(Spring Boot)への通信をまとめる共通処理。
// URLの組み立てやエラー処理を1箇所にまとめておくことで、
// 各画面のコードでは「何を送って何を受け取るか」だけに集中できるようにしている。

const BASE_URL = 'http://localhost:8080/api';

/**
 * 共通のfetch処理。成功時はJSONを返し、失敗時はエラーメッセージ付きの例外を投げる。
 * バックエンド側のGlobalExceptionHandlerが返す { "error": "説明文" } という形を
 * そのままエラーメッセージとして拾えるようにしている。
 */
async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    // レスポンスの中身がJSONでない場合(想定外のエラー)にも耐えられるよう、
    // JSON解析に失敗したら空オブジェクトとして扱う。
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `リクエストに失敗しました(status: ${response.status})`);
  }

  // 204 No Content等、レスポンスに中身が無いケースにも対応する。
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function apiGet(path) {
  return request(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) });
}
