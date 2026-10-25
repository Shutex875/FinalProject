import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi, setAccessToken, getAccessToken } from './api';
import { AUTH_SESSION_INVALIDATED, canRestoreSession, getSessionVersion, invalidateSession } from './authSession';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    // 1. Инициализируем токен из localStorage при старте и СРАЗУ прокидываем в api.js
    const [token, setTokenState] = useState(() => {
        const savedToken = localStorage.getItem('accessToken');
        if (savedToken) {
            setAccessToken(savedToken); // <--- ВОТ ЭТОТ КЛЮЧЕВОЙ МОМЕНТ
        }
        return savedToken || null;
    });

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

    useEffect(() => {
        const clearSession = () => {
            setTokenState(null);
            setUser(null);
            navigate('/login', { replace: true });
        };
        window.addEventListener(AUTH_SESSION_INVALIDATED, clearSession);
        return () => window.removeEventListener(AUTH_SESSION_INVALIDATED, clearSession);
    }, [navigate]);

    const logout = useCallback(async ({ localOnly = false } = {}) => {
        const previousToken = getAccessToken();
        invalidateSession();
        if (localOnly || !previousToken) return;
        try {
            await authApi.logout(previousToken);
        } catch (e) {
            console.error('Logout error:', e);
        }
    }, []);

    const deactivateAccount = async () => {
        await authApi.deactivateProfile();
        // DELETE /auth/profile already revokes credentials and clears the cookie.
        await logout({ localOnly: true });
    };

    const updateUser = useCallback(async (newUserData) => {
        setUser(prev => ({ ...prev, ...newUserData }));
        return newUserData;
    }, []);

    useEffect(() => {
        if (getAccessToken() || !canRestoreSession()) return;
        let active = true;
        const version = getSessionVersion();
        authApi.refresh().then(response => {
            if (active && version === getSessionVersion() && response?.token) {
                handleAuthSuccess(response);
            }
        }).catch(() => {});
        return () => { active = false; };
    }, [handleAuthSuccess]);

    const value = {
        token,
        user,
        login,
        register,
        logout,
        deactivateAccount,
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
