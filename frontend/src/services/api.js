import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('htu_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('htu_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// --- Auth ---
export const login = (password) => api.post('/auth/login', { password });

// --- Machines ---
export const getMachines = () => api.get('/machines/');
export const createMachine = (name) => api.post('/machines/', { name });
export const deleteMachine = (id) => api.delete(`/machines/${id}`);

// --- Imports ---
export const uploadTsv = (file, machineName, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('machine_name', machineName);
  return api.post('/imports/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });
};
export const getImports = () => api.get('/imports/');
export const deleteImport = (id) => api.delete(`/imports/${id}`);

// --- History ---
export const searchHistory = (params) => api.post('/history/search', params);
export const getStats = (machineIds) =>
  api.get('/history/stats', {
    params: machineIds ? { machine_ids: machineIds.join(',') } : {},
  });
