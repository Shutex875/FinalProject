import axios from 'axios';
import { getAccessToken, setAccessToken, getSessionVersion, invalidateSession } from './authSession';
export { getAccessToken, setAccessToken } from './authSession';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

instance.interceptors.request.use((config) => {
    config._sessionVersion = getSessionVersion();
    const accessToken = getAccessToken();
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

instance.interceptors.response.use(
    (response) => {
        if (response.config?._sessionVersion !== undefined && response.config._sessionVersion !== getSessionVersion()) {
            return Promise.reject(new Error('Session changed'));
        }
        return response.data;
    },
    async (error) => {
        const data = error.response?.data;
        const validationMessage = Array.isArray(data?.errors)
            ? data.errors.map(item => item.msg).filter(Boolean).join('; ')
            : '';
        error.message = data?.message || data?.error || validationMessage || error.message || 'Server Error';
        error.status = error.response?.status;
        const stale = error.config?._sessionVersion !== undefined && error.config._sessionVersion !== getSessionVersion();
        const blockedAccount = error.status === 403 && /conta.*(bloquead|indispon)|blocked.*account|account.*blocked/i.test(error.message);
        if (!stale && (error.status === 401 || blockedAccount)) invalidateSession();
        return Promise.reject(error);
    }
);

export const authApi = {
    login: (credentials) => instance.post('/auth/login', credentials),
    register: (userData) => instance.post('/auth/register', userData),
    getProfile: () => instance.get('/auth/profile'),
    logout: (token) => instance.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }),
    deactivateProfile: () => instance.delete('/auth/profile'),
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
    // The server checks out the stored cart and calculates all prices and totals.
    create: ({ address, phone, comment }) => instance.post('/orders', { address, phone, comment }),
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

const api = {
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

export default api;
