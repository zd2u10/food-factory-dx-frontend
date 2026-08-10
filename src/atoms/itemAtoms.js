import { atom } from 'jotai';

// 現在編集中の商品(nullなら新規登録モード)
export const editingItemAtom = atom(null);
