import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Lock, X, ShieldCheck } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CustomSelect from '../components/CustomSelect';
import './CategoriesPage.css';

export const CategoriesPage = () => {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [isSystem, setIsSystem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCategories();
      setCategories(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setType('expense');
    setIsSystem(false);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIsSystem(Boolean(cat.is_system));
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!name.trim()) {
      setModalError('Category name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: name.trim(), type });
      } else {
        await api.createCategory({
          name: name.trim(),
          type,
          is_system: isAdmin ? isSystem : false,
        });
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      setModalError(err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, isSystemCat = false) => {
    const msg = isSystemCat
      ? 'Delete this Global Default Category for all users? (Only allowed if no transactions reference it)'
      : 'Are you sure you want to delete this custom category?';
    if (!window.confirm(msg)) return;
    try {
      await api.deleteCategory(id);
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const renderCategoryRow = (c) => (
    <div key={c.id} className="cat-item-row">
      <div className="cat-item-left">
        <span className="cat-item-name">{c.name}</span>
        <span className={`badge ${c.is_system ? 'badge-system' : 'badge-custom'}`}>
          {c.is_system ? 'Default' : 'Custom'}
        </span>
      </div>
      <div>
        {c.is_system && !isAdmin ? (
          <span title="System default categories are protected" className="cat-lock-icon">
            <Lock size={14} />
          </span>
        ) : (
          <div className="cat-actions">
            <button
              onClick={() => handleOpenEdit(c)}
              className="icon-btn edit"
              title="Edit category"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => handleDelete(c.id, c.is_system)}
              className="icon-btn delete"
              title="Delete category"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="content-body">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Category Management</h2>
          <p className="page-subtitle">
            {isAdmin
              ? 'Admin Mode: You can manage both global default categories and personal categories'
              : 'Organize your finances with system and custom categories'}
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={16} />
          <span>New Category</span>
        </button>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      {loading ? (
        <div className="page-loading-box">Loading categories...</div>
      ) : (
        <div className="grid-cols-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title with-icon expense">
                <Tag size={18} /> Expense Categories ({expenseCategories.length})
              </h3>
            </div>
            <div className="cat-list">{expenseCategories.map(renderCategoryRow)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title with-icon income">
                <Tag size={18} /> Income Categories ({incomeCategories.length})
              </h3>
            </div>
            <div className="cat-list">{incomeCategories.map(renderCategoryRow)}</div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="cat-modal-header">
              <h3 className="cat-modal-title">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="icon-btn">
                <X size={20} />
              </button>
            </div>

            {modalError && <div className="alert-banner error">{modalError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mutual Funds, UPI Transfers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category Type</label>
                <CustomSelect
                  value={type}
                  onChange={(val) => setType(val)}
                  disabled={!!editingCategory}
                  options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                  ]}
                />
              </div>

              {isAdmin && !editingCategory && (
                <div className="form-group">
                  <label className="cat-admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isSystem}
                      onChange={(e) => setIsSystem(e.target.checked)}
                    />
                    <ShieldCheck size={16} className="cat-admin-shield" />
                    <span>Create as Global Default Category (available to all users)</span>
                  </label>
                </div>
              )}

              <div className="cat-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
