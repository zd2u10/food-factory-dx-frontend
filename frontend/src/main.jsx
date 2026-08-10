import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';

// QueryClient: TanStack Queryが取得したデータをキャッシュ(一時保存)しておく本体。
// アプリ全体で1つだけ作り、<QueryClientProvider>を通じて全コンポーネントに配る。
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      Provider(jotai)とQueryClientProvider(TanStack Query)は役割が別なので、
      両方を重ねて使う。
        jotai            : フィルター条件・編集対象など「画面だけで完結する状態」
        TanStack Query   : サーバーから取ってきたデータ(一覧など)の取得・キャッシュ・再取得
    */}
    <QueryClientProvider client={queryClient}>
      <Provider>
        <App />
      </Provider>
    </QueryClientProvider>
  </React.StrictMode>
);
