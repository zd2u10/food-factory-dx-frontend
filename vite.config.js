import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Viteの設定ファイル。react()プラグインを有効化するだけの最小構成。
// 開発サーバーは初期状態のポート5173で起動する
// (Spring Boot側の8080とは別ポートなので、同時に起動しても衝突しない)。
export default defineConfig({
  plugins: [react()],
});
