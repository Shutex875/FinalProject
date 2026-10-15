import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { authApi, setAccessToken } from './api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // 1. Инициализируем токен из localStorage при старте
    const [token, setTokenState] = useState(() => localStorage.getItem('accessToken') || null);
    const [user, setUser] = useState(() => {
        const savedToken = localStorage.getItem('accessToken');
        if (savedToken) {
            try {
                return jwtDecode(savedToken);
            } catch (e) {
                return null;
            }
        }
        return null;
    });

    const setToken = useCallback((newToken) => {
        setTokenState(newToken);
        setAccessToken(newToken);
        if (newToken) {
            localStorage.setItem('accessToken', newToken);
        } else {
            localStorage.removeItem('accessToken');
        }
    }, []);

    const handleAuthSuccess = useCallback((data) => {
        const receivedToken = data.token;
        if (receivedToken) {
            setToken(receivedToken);
        }

        if (data.user) {
            setUser(data.user);
        } else if (receivedToken) {
            try {
                const decoded = jwtDecode(receivedToken);
                setUser(decoded);
            } catch (e) {
                console.error("Erro ao decodificar token", e);
            }
        }
        return data;
    }, [setToken]);

    const login = async (credentials) => {
        const response = await authApi.login(credentials);
        return handleAuthSuccess(response);
    };

    const register = async (userData) => {
        const response = await authApi.register(userData);
        return handleAuthSuccess(response);
    };

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch (e) {
            console.error('Logout error:', e);
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('accessToken');
    }, [setToken]);

    const updateUser = useCallback(async (newUserData) => {
        setUser(prev => ({ ...prev, ...newUserData }));
        return newUserData;
    }, []);

    useEffect(() => {
        const backgroundRefresh = async () => {
            try {
                const response = await axios.post('/auth/refresh', {}, {
                    baseURL: process.env.REACT_APP_API_URL || 'http://13.38.76.64:5000',
                    withCredentials: true
                });
                if (response.data?.token) {
                    setToken(response.data.token);
                    setUser(jwtDecode(response.data.token));
                }
            } catch (refreshError) {
                console.log('Background refresh skipped or failed');
            }
        };

        if (!token) {
            backgroundRefresh();
        }
    }, [token, setToken]);

    const value = {
        token,
        user,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'ADMIN'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
