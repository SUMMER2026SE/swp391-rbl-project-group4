import Button from './Button';

export default function DataTable({ columns, data, loading, onEdit, onDelete, actions }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-low border-b border-outline/30">
            {columns.map(col => (
              <th key={col.key} className="text-left px-4 py-3 font-semibold text-on-muted text-xs uppercase tracking-wide">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete || actions) && (
              <th className="text-right px-4 py-3 font-semibold text-on-muted text-xs uppercase tracking-wide w-32">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-12 text-on-muted">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inbox</span>
                Không có dữ liệu
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i} className="border-b border-outline/20 hover:bg-surface-low/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-charcoal">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {(onEdit || onDelete || actions) && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {actions && actions(row)}
                    {onEdit && (
                      <button onClick={() => onEdit(row)} title="Chỉnh sửa"
                        className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(row)} title="Xóa"
                        className="p-1.5 text-on-muted hover:text-error hover:bg-error-bg rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
