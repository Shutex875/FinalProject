import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

let isRefreshing = false;
let failedQueue = [];
let accessToken = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

instance.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

instance.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return instance(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                const newToken = response.data.token;
                accessToken = newToken;
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return instance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                accessToken = null;
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        const message = error.response?.data?.message || error.response?.data?.error || 'Server Error';
        return Promise.reject(new Error(message));
    }
);

export const setAccessToken = (token) => {
    accessToken = token;
};

export const getAccessToken = () => accessToken;

export const authApi = {
    login: (credentials) => instance.post('/auth/login', credentials),
    register: (userData) => instance.post('/auth/register', userData),
    getProfile: () => instance.get('/auth/profile'),
    logout: () => instance.post('/auth/logout'),
    refresh: () => instance.post('/auth/refresh'),
    updateProfile: (data) => instance.put('/auth/profile', data),
};

export const productsApi = {
    getAll: (params) => instance.get('/products', { params }),
    getById: (id) => instance.get(`/products/${id}`),
};

export const templatesApi = productsApi;

export const tagsApi = {
    getPopularTags: () => instance.get('/products'),
};

export const ordersApi = {
    create: (orderData) => instance.post('/orders', orderData),
    getMyOrders: () => instance.get('/orders/my'),
};

export const adminApi = {
    getUsers: (params) => instance.get('/admin/users', { params }),
    updateUserRole: (id, role) => instance.put(`/admin/users/${id}/role`, { role }),
    toggleUserBlock: (id, isBlocked) => instance.put(`/admin/users/${id}/block`, { isBlocked }),
    deleteUser: (id) => instance.delete(`/admin/users/${id}`),
    getProducts: (params) => instance.get('/admin/products', { params }),
    updateProductStock: (id, stock) => instance.put(`/admin/products/${id}/stock`, { stock }),
    createProduct: (productData) => instance.post('/admin/products', productData),
    deleteProduct: (id) => instance.delete(`/admin/products/${id}`),
    getCategories: () => instance.get('/admin/categories'),
    uploadImage: (formData) => instance.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getOrders: (params) => instance.get('/admin/orders', { params }),
    updateOrderStatus: (id, status) => instance.put(`/admin/orders/${id}/status`, { status }),
    deleteOrder: (id) => instance.delete(`/admin/orders/${id}`),
};

export const likesApi = {
    getLikeStatus: (productId) => instance.get(`/likes/status/${productId}`),
    toggleLike: (productId) => instance.post(`/likes/toggle/${productId}`),
    getUserLikes: () => instance.get('/likes/user'),
};

export const cartApi = {
    getCart: () => instance.get('/cart'),
    addToCart: (productId, quantity = 1) => instance.post('/cart/add', { productId, quantity }),
    updateCartItem: (productId, quantity) => instance.put('/cart/update', { productId, quantity }),
    removeFromCart: (productId) => instance.delete(`/cart/remove/${productId}`),
    clearCart: () => instance.delete('/cart/clear'),
};

export const reviewsApi = {
    getByProductId: (productId) => instance.get(`/reviews/product/${productId}`),
    addToProduct: (data) => instance.post('/reviews', data),
    updateReview: (id, data) => instance.put(`/reviews/${id}`, data),
    deleteReview: (id) => instance.delete(`/reviews/${id}`),
};

export default {
    authApi,
    productsApi,
    templatesApi,
    tagsApi,
    ordersApi,
    adminApi,
    likesApi,
    cartApi,
    reviewsApi,
    instance,
    setAccessToken,
    getAccessToken
};
