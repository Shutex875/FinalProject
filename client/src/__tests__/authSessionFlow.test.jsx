import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { CartProvider, useCart } from '../context/CartContext';
import { authApi, cartApi } from '../api';
import { getAccessToken, invalidateSession, setAccessToken, canRestoreSession } from '../authSession';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('jwt-decode', () => ({ jwtDecode: () => ({ id: 1, name: 'Customer' }) }));
jest.mock('../api', () => ({
  ...jest.requireActual('../authSession'),
  authApi: { deactivateProfile: jest.fn(), logout: jest.fn(), refresh: jest.fn() },
  cartApi: { getCart: jest.fn() },
}));

let auth, cart;
function Probe() { auth = useAuth(); cart = useCart(); return null; }
function mount() { return render(<AuthProvider><CartProvider><Probe /></CartProvider></AuthProvider>); }
const items = [{ id: 1, quantity: 2, price: '10.00' }];
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  setAccessToken(null);
  localStorage.setItem('accessToken', 'saved-token');
  cartApi.getCart.mockResolvedValue(items);
  authApi.deactivateProfile.mockResolvedValue({});
  authApi.logout.mockResolvedValue({});
});

test('deactivation clears tokens, user and cart and redirects to login', async () => {
  mount();
  await waitFor(() => expect(cart.cartCount).toBe(2));
  await act(async () => { await auth.deactivateAccount(); });
  expect(authApi.deactivateProfile).toHaveBeenCalledTimes(1);
  expect(auth.token).toBeNull();
  expect(auth.user).toBeNull();
  expect(auth.isAuthenticated).toBe(false);
  expect(getAccessToken()).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
  expect(cart.cartCount).toBe(0);
  expect(cart.cartItems).toEqual([]);
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  expect(authApi.logout).not.toHaveBeenCalled();
  expect(authApi.refresh).not.toHaveBeenCalled();
});

test('failed deactivation retains the active session and cart', async () => {
  authApi.deactivateProfile.mockRejectedValueOnce(new Error('Server unavailable'));
  mount();
  await waitFor(() => expect(cart.cartCount).toBe(2));
  await act(async () => { await expect(auth.deactivateAccount()).rejects.toThrow('Server unavailable'); });
  expect(auth.token).toBe('saved-token');
  expect(cart.cartCount).toBe(2);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('logout clears local state before the network request completes', async () => {
  let finish;
  authApi.logout.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount();
  await waitFor(() => expect(cart.cartCount).toBe(2));
  let request;
  act(() => { request = auth.logout(); });
  expect(auth.token).toBeNull();
  expect(cart.cartCount).toBe(0);
  expect(canRestoreSession()).toBe(false);
  await act(async () => { finish(); await request; });
});

test('late cart responses cannot restore a logged-out cart', async () => {
  let finish;
  cartApi.getCart.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount();
  act(() => { invalidateSession(); });
  await act(async () => { finish(items); });
  expect(auth.user).toBeNull();
  expect(cart.cartCount).toBe(0);
  expect(cart.loading).toBe(false);
});

test('late refresh cannot silently sign the user in after invalidation', async () => {
  localStorage.clear();
  let finish;
  authApi.refresh.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount();
  act(() => { invalidateSession(); });
  await act(async () => { finish({ token: 'late-token', user: { id: 1 } }); });
  expect(auth.token).toBeNull();
  expect(getAccessToken()).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});
