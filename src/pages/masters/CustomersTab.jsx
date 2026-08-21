import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCustomer, listCustomers, updateCustomer } from '../../api/customerApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { name: '', customerType: 'B2B', requiredResidualDays: '' };

/**
 * 取引先マスタ。material・itemsと違い、論理削除(廃版)機能は持たせない。
 * 一度取引が成立した取引先は記録としてそのまま残すべきで、
 * 「廃版」という概念自体が馴染まないという判断による(ユーザーとの合意事項)。
 * 誤登録があれば「編集」で直せばよい、という運用にしている。
 *
 * 残存期限ルールは「あと何日残っていれば出荷できるか」という日数で入力する
 * (割合(%)だと商品ごとの賞味期限日数を都度換算する必要があり分かりにくいため)。
 */
export default function CustomersTab() {
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: listCustomers,
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ customerId, customer }) => updateCustomer(customerId, customer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      setShowForm(false);
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const displayError = error?.message || createMutation.error?.message || updateMutation.error?.message;

  function handleRequestSubmit(formValues) {
    // 任意項目のため、空欄はnullとして送る(Integer変換エラーを避けるため)。
    setPendingSubmit({
      name: formValues.name,
      customerType: formValues.customerType,
      requiredResidualDays: formValues.requiredResidualDays === '' ? null : Number(formValues.requiredResidualDays),
    });
  }

  function handleConfirmSubmit() {
    if (editingCustomer) {
      updateMutation.mutate({ customerId: editingCustomer.customerId, customer: pendingSubmit });
    } else {
      createMutation.mutate(pendingSubmit);
    }
    setPendingSubmit(null);
  }

  function handleEdit(customer) {
    setEditingCustomer(customer);
    setShowForm(true);
  }

  function handleToggleForm() {
    if (showForm) {
      setEditingCustomer(null);
    }
    setShowForm((prev) => !prev);
  }

  return (
    <div>
      {displayError && (
        <div className="alert alert-danger" role="alert">
          {displayError}
        </div>
      )}

      <button type="button" className="btn btn-success mb-3" onClick={handleToggleForm}>
        {showForm ? 'フォームを閉じる' : '+ 新規取引先登録'}
      </button>

      <div className="row g-4">
        {showForm && (
          <div className="col-12 col-lg-4">
            <CustomerForm
              key={editingCustomer ? editingCustomer.customerId : 'new'}
              initialValue={editingCustomer ?? emptyForm}
              isEditing={!!editingCustomer}
              isSaving={isSaving}
              onSubmit={handleRequestSubmit}
              onCancelEdit={() => {
                setEditingCustomer(null);
                setShowForm(false);
              }}
            />
          </div>
        )}

        <div className={showForm ? 'col-12 col-lg-8' : 'col-12'}>
          <h2 className="h5 mb-3">登録済み取引先一覧</h2>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>取引先名</th>
                  <th>区分</th>
                  <th>残存期限ルール</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      まだ取引先が登録されていません
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.customerId}>
                      <td>{customer.customerId}</td>
                      <td>{customer.name}</td>
                      <td>{customer.customerType === 'B2B' ? '法人' : '個人'}</td>
                      <td>
                        {customer.requiredResidualDays != null
                          ? `${customer.requiredResidualDays}日以上`
                          : '指定なし'}
                      </td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => handleEdit(customer)}>
                          編集
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title={editingCustomer ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingCustomer ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                { label: '取引先名', value: pendingSubmit.name },
                { label: '区分', value: pendingSubmit.customerType === 'B2B' ? '法人' : '個人' },
                {
                  label: '残存期限ルール',
                  value:
                    pendingSubmit.requiredResidualDays != null
                      ? `賞味期限があと${pendingSubmit.requiredResidualDays}日以上残っている商品のみ出荷可`
                      : '指定なし',
                },
              ]
            : []
        }
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />
    </div>
  );
}

function CustomerForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(initialValue);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">{isEditing ? '取引先を編集' : '新規取引先登録'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              取引先名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-control"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="customerType" className="form-label">
              区分
            </label>
            <select
              id="customerType"
              name="customerType"
              className="form-select"
              value={form.customerType}
              onChange={handleChange}
            >
              <option value="B2B">法人(B2B)</option>
              <option value="B2C">個人(B2C)</option>
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="requiredResidualDays" className="form-label">
              残存期限ルール(任意)
            </label>
            <div className="input-group">
              <input
                id="requiredResidualDays"
                name="requiredResidualDays"
                type="number"
                min="0"
                step="1"
                className="form-control"
                value={form.requiredResidualDays}
                onChange={handleChange}
                placeholder="例: 66"
              />
              <span className="input-group-text">日以上</span>
            </div>
            <div className="form-text">
              賞味期限まで「入力した日数」以上残っている商品でないと、この取引先には出荷できなくなります。
              <br />
              例:「66」と入力した場合 → 賞味期限まであと66日未満の商品は出荷できません。
              <br />
              特に制限が無ければ空欄のままで構いません。
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={isSaving}>
              {isSaving ? '送信中...' : isEditing ? '更新する' : '登録する'}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelEdit}>
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
