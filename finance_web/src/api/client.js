export const getApiBase = () => {
  if (import.meta?.env?.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1`;
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://fastapi-finance-tracker.onrender.com/api/v1';
  }
  return '/api/v1';
};

const API_BASE = getApiBase();

export const extractErrorMessage = (data, fallback = 'API Request failed') => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    const msgs = data.detail
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (item.msg) {
          const field = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== 'body').join('.')
            : '';
          return field ? `${field}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join('; ');
  }

  if (data.detail && typeof data.detail === 'object') {
    if (typeof data.detail.msg === 'string') return data.detail.msg;
    if (typeof data.detail.message === 'string') return data.detail.message;
    if (typeof data.detail.error === 'string') return data.detail.error;
    try {
      return JSON.stringify(data.detail);
    } catch {
      return fallback;
    }
  }

  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error === 'object') {
    if (typeof data.error.message === 'string') return data.error.message;
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e)))
      .join('; ');
  }

  return fallback;
};

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.refreshPromise = null;
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    } else {
      localStorage.removeItem('access_token');
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async request(endpoint, options = {}) {
    const base = getApiBase();
    const url = `${base}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const headers = isFormData
      ? { ...options.headers }
      : {
          'Content-Type': 'application/json',
          ...options.headers,
        };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token}`;
        response = await fetch(url, { ...options, headers });
      } else {
        this.clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = extractErrorMessage(data, `Request failed with status ${response.status}`);
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async refreshAccessToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const base = getApiBase();
        const resp = await fetch(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
        if (resp.ok) {
          const data = await resp.json();
          this.setTokens(data.access_token, data.refresh_token);
          return true;
        }
      } catch {
      } finally {
        this.refreshPromise = null;
      }
      return false;
    })();
    return this.refreshPromise;
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async register(email, password, full_name) {
    const data = await this.post('/auth/register', { email, password, full_name });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async logout() {
    try {
      await this.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  getMe() {
    return this.get('/users/me');
  }

  updateProfile(data) {
    return this.patch('/users/me', data);
  }

  changePassword(data) {
    return this.post('/users/me/change-password', data);
  }

  getCategories(type) {
    return this.get('/categories', { type });
  }

  createCategory(data) {
    return this.post('/categories', data);
  }

  updateCategory(id, data) {
    return this.patch(`/categories/${id}`, data);
  }

  deleteCategory(id) {
    return this.delete(`/categories/${id}`);
  }

  getTransactions(params) {
    return this.get('/transactions', params);
  }

  getTransaction(id) {
    return this.get(`/transactions/${id}`);
  }

  createTransaction(data) {
    return this.post('/transactions', data);
  }

  updateTransaction(id, data) {
    return this.patch(`/transactions/${id}`, data);
  }

  deleteTransaction(id) {
    return this.delete(`/transactions/${id}`);
  }

  clearAllTransactions() {
    return this.delete('/transactions/clear-all');
  }

  importTransactions(files) {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    return this.request('/transactions/import', {
      method: 'POST',
      body: formData,
    });
  }

  async exportTransactionsCsv(params = {}) {
    const csvText = await this.get('/transactions/export', params);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'finance_intel_ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async downloadImportTemplate(format = 'csv') {
    const fmt = format.toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const base = getApiBase();
    const resp = await fetch(`${base}/transactions/import-template?format=${fmt}`, {
      method: 'GET',
      headers,
    });
    if (!resp.ok) {
      throw new Error(`Failed to download ${fmt.toUpperCase()} template.`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_import_template.${fmt}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getDashboard(search = '') {
    return this.get('/reports/dashboard', { search });
  }

  getMonthlyReport(months = 6) {
    return this.get('/reports/monthly', { months });
  }

  getCategoryReport(startDate, endDate, type = 'expense') {
    return this.get('/reports/categories', {
      start_date: startDate,
      end_date: endDate,
      type,
    });
  }

  getAdminOverview() {
    return this.get('/admin/overview');
  }

  updateAdminUser(userId, data) {
    return this.patch(`/admin/users/${userId}`, data);
  }

  deleteAdminUser(userId) {
    return this.delete(`/admin/users/${userId}`);
  }

  getBudgetOverview() {
    return this.get('/budgets/overview');
  }

  getBudgets() {
    return this.get('/budgets');
  }

  createBudget(data) {
    return this.post('/budgets', data);
  }

  updateBudget(id, data) {
    return this.patch(`/budgets/${id}`, data);
  }

  deleteBudget(id) {
    return this.delete(`/budgets/${id}`);
  }

  testBudgetAlert(id) {
    return this.post(`/budgets/${id}/test-alert`);
  }

  getAlertNotifications() {
    return this.get('/budgets/notifications');
  }

  getStreamBooks() {
    return this.get('/streams/books');
  }

  createStreamBook(data) {
    return this.post('/streams/books', data);
  }

  getStreamBook(bookId) {
    return this.get(`/streams/books/${bookId}`);
  }

  updateStreamBook(bookId, data) {
    return this.patch(`/streams/books/${bookId}`, data);
  }

  deleteStreamBook(bookId) {
    return this.delete(`/streams/books/${bookId}`);
  }

  getStreamEntries(bookId, params = {}) {
    return this.get(`/streams/books/${bookId}/entries`, params);
  }

  createStreamEntry(bookId, data) {
    return this.post(`/streams/books/${bookId}/entries`, data);
  }

  updateStreamEntry(bookId, entryId, data) {
    return this.patch(`/streams/books/${bookId}/entries/${entryId}`, data);
  }

  deleteStreamEntry(bookId, entryId) {
    return this.delete(`/streams/books/${bookId}/entries/${entryId}`);
  }

  async downloadStreamExport(bookId, bookTitle = 'stream') {
    const csvText = await this.get(`/streams/books/${bookId}/export`);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanTitle = (bookTitle || 'stream').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    link.setAttribute('download', `${cleanTitle}_ledger_statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();
export default api;

