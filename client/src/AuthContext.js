import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { authApi, setAccessToken } from './api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setTokenState] = useState(null);
    const [user, setUser] = useState(null);                                                                                                                  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    const [loading, setLoading] = useState(true);

    const setToken = useCallback((newToken) => {
        setTokenState(newToken);
        setAccessToken(newToken);
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
    }, [setToken]);

    // Новый метод обновления профиля
    const updateUser = useCallback(async (newUserData) => {
        // newUserData содержит обновлённые поля пользователя (например, name)
        setUser(prev => ({ ...prev, ...newUserData }));
        return newUserData;
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const response = await axios.post('/auth/refresh', {}, {
                    baseURL: process.env.REACT_APP_API_URL || 'http://13.38.76.64:5000',
                    withCredentials: true
                });
                if (response.data?.token) {
                    const newToken = response.data.token;
                    setToken(newToken);
                    try {
                        const decoded = jwtDecode(newToken);
                        setUser(decoded);
                    } catch (e) {
                        console.error("Erro ao decodificar token", e);
                    }
                }
            } catch (refreshError) {
                console.log('No valid session');
            }
            setLoading(false);
        };
        initAuth();
    }, [setToken]);

    const value = {                                                                                                                                                //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        token,
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'ADMIN'
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
