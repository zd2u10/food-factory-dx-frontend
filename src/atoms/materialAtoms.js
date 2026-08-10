import { atom } from 'jotai';

// ここに残すのは「画面だけで完結する状態」だけにする。
// 一覧データ・読み込み中フラグ・エラーは、TanStack Query(useQuery)が
// 自動的に管理してくれるようになったため、atomとしては持たせない。

// フィルター条件: 分類(''=絞り込まない, 'RAW', 'ADDITIVE')
export const categoryFilterAtom = atom('');

// フィルター条件: 有効/廃版('' = 絞り込まない, 'true', 'false')
export const activeFilterAtom = atom('');

// 現在編集中の材料(nullなら新規登録モード、値が入っていれば編集モード)
export const editingMaterialAtom = atom(null);
