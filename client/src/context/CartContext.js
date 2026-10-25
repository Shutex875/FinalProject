import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { cartApi } from '../api';
import { useAuth } from '../AuthContext';
import { AUTH_SESSION_INVALIDATED, getSessionVersion } from '../authSession';
import { isValidQuantity } from '../utils/commerce';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(Boolean(isAuthenticated && token));

    useEffect(() => {
        const resetCart = () => { setCartItems([]); setLoading(false); };
        window.addEventListener(AUTH_SESSION_INVALIDATED, resetCart);
        return () => window.removeEventListener(AUTH_SESSION_INVALIDATED, resetCart);
    }, []);

    const loadCart = useCallback(async () => {
        const version = getSessionVersion();
        if (!isAuthenticated || !token) {
            setCartItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const items = await cartApi.getCart();
            if (version === getSessionVersion()) setCartItems(items);
        } catch (err) {
            console.error('Failed to load cart', err);
        } finally {
            if (version === getSessionVersion()) setLoading(false);
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        loadCart();
    }, [loadCart]);

    const addToCart = async (product, quantity = 1) => {
        if (!isAuthenticated) return;
        const version = getSessionVersion();
        if (!isValidQuantity(quantity)) throw new Error('Quantity must be an integer between 1 and 99');
        const existingQuantity = cartItems.find(item => item.id === product.id)?.quantity || 0;
        if (existingQuantity + quantity > 99) throw new Error('Maximum quantity per product is 99');
        try {
            const updatedCart = await cartApi.addToCart(product.id, quantity);
            if (version === getSessionVersion()) setCartItems(updatedCart);
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const removeFromCart = async (productId) => {
        if (!isAuthenticated) return;
        const version = getSessionVersion();
        try {
            const updatedCart = await cartApi.removeFromCart(productId);
            if (version === getSessionVersion()) setCartItems(updatedCart);
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const updateQuantity = async (productId, amount) => {
        if (!isAuthenticated) return;
        const version = getSessionVersion();
        const currentItem = cartItems.find(item => item.id === productId);
        if (!currentItem) return;
        if (!Number.isInteger(amount)) return;
        const newQuantity = currentItem.quantity + amount;
        if (!isValidQuantity(newQuantity) || amount === 0) return;
        try {
            const updatedCart = await cartApi.updateCartItem(productId, newQuantity);
            if (version === getSessionVersion()) setCartItems(updatedCart);
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const clearCart = async () => {
        if (!isAuthenticated) return;
        const version = getSessionVersion();
        try {
            await cartApi.clearCart();
            if (version === getSessionVersion()) setCartItems([]);
        } catch (err) {
            console.error(err);
        }
    };

    const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            loadCart,
            cartCount,
            cartTotal,
            loading
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
