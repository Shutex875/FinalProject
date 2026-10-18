import { render, act, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from '../CartContext';

import { cartApi } from '../../api';
import { useAuth } from '../../AuthContext';

jest.mock('../../api', () => ({
  cartApi: {
    getCart: jest.fn(),
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
  },
}));

jest.mock('../../AuthContext', () => ({
  useAuth: jest.fn(),
}));

const TestComponent = ({ onRender }) => {
  const cart = useCart();
  onRender(cart);
  return null;
};

describe('CartContext', () => {
  let cartValue;
  let mockUseAuth;

  beforeEach(() => {
    cartValue = null;
    jest.clearAllMocks();

    mockUseAuth = {
      token: 'fake-token',
      isAuthenticated: true,
    };
    useAuth.mockReturnValue(mockUseAuth);
    cartApi.getCart.mockResolvedValue([]);
  });

  const renderCart = () => {
    render(
      <CartProvider>
        <TestComponent onRender={(value) => { cartValue = value; }} />
      </CartProvider>
    );
  };

  const mockProduct = { id: 1, name: 'Test Product', price: 99.99, brand: 'Test Brand' };
  const mockProduct2 = { id: 2, name: 'Another Product', price: 49.99, brand: 'Another Brand' };

  it('should initialize with empty cart', async () => {
    renderCart();
    await waitFor(() => {
      expect(cartValue).toEqual(expect.objectContaining({
        cartItems: [],
        cartCount: 0,
        cartTotal: 0,
      }));
    });
  });

  it('should add product to cart', async () => {
    const updatedCart = [{ ...mockProduct, quantity: 1 }];
    cartApi.addToCart.mockResolvedValue(updatedCart);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
    });

    expect(cartApi.addToCart).toHaveBeenCalledWith(mockProduct.id, 1);
    expect(cartValue.cartItems).toEqual(updatedCart);
    expect(cartValue.cartCount).toBe(1);
    expect(cartValue.cartTotal).toBeCloseTo(99.99);
  });

  it('should increase quantity when adding same product', async () => {
    const updatedCart1 = [{ ...mockProduct, quantity: 1 }];
    const updatedCart2 = [{ ...mockProduct, quantity: 2 }];
    cartApi.addToCart.mockResolvedValueOnce(updatedCart1).mockResolvedValueOnce(updatedCart2);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
      await cartValue.addToCart(mockProduct);
    });

    expect(cartApi.addToCart).toHaveBeenCalledTimes(2);
    expect(cartValue.cartItems).toEqual(updatedCart2);
    expect(cartValue.cartItems[0].quantity).toBe(2);
    expect(cartValue.cartCount).toBe(2);
    expect(cartValue.cartTotal).toBeCloseTo(199.98);
  });

  it('should add product with custom quantity', async () => {
    const updatedCart = [{ ...mockProduct, quantity: 3 }];
    cartApi.addToCart.mockResolvedValue(updatedCart);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct, 3);
    });

    expect(cartApi.addToCart).toHaveBeenCalledWith(mockProduct.id, 3);
    expect(cartValue.cartItems[0].quantity).toBe(3);
    expect(cartValue.cartCount).toBe(3);
    expect(cartValue.cartTotal).toBeCloseTo(299.97);
  });

  it('should remove product from cart', async () => {
    const updatedCartAfterAdd = [{ ...mockProduct, quantity: 1 }, { ...mockProduct2, quantity: 1 }];
    const updatedCartAfterRemove = [{ ...mockProduct2, quantity: 1 }];
    cartApi.addToCart.mockResolvedValue(updatedCartAfterAdd);
    cartApi.removeFromCart.mockResolvedValue(updatedCartAfterRemove);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
      await cartValue.addToCart(mockProduct2);
      await cartValue.removeFromCart(1);
    });

    expect(cartApi.removeFromCart).toHaveBeenCalledWith(1);
    expect(cartValue.cartItems).toEqual(updatedCartAfterRemove);
    expect(cartValue.cartCount).toBe(1);
    expect(cartValue.cartTotal).toBeCloseTo(49.99);
  });

  it('should update quantity by amount', async () => {
    const updatedCartAfterAdd = [{ ...mockProduct, quantity: 1 }];
    const updatedCartAfterUpdate = [{ ...mockProduct, quantity: 3 }];
    cartApi.addToCart.mockResolvedValue(updatedCartAfterAdd);
    cartApi.updateCartItem.mockResolvedValue(updatedCartAfterUpdate);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
    });

    // ESPERAR que o estado do carrinho seja atualizado
    await waitFor(() => expect(cartValue.cartItems.length).toBe(1));

    await act(async () => {
      await cartValue.updateQuantity(1, 2);
    });

    expect(cartApi.updateCartItem).toHaveBeenCalledWith(1, 3);
    expect(cartValue.cartItems[0].quantity).toBe(3);
    expect(cartValue.cartCount).toBe(3);
    expect(cartValue.cartTotal).toBeCloseTo(299.97);
  });

  it('should not decrease quantity below 1', async () => {
    const updatedCartAfterAdd = [{ ...mockProduct, quantity: 1 }];
    cartApi.addToCart.mockResolvedValue(updatedCartAfterAdd);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
      await cartValue.updateQuantity(1, -5);
    });

    expect(cartApi.updateCartItem).not.toHaveBeenCalled();
    expect(cartValue.cartItems[0].quantity).toBe(1);
    expect(cartValue.cartCount).toBe(1);
    expect(cartValue.cartTotal).toBeCloseTo(99.99);
  });

  it('should clear cart', async () => {
    const updatedCartAfterAdd = [{ ...mockProduct, quantity: 1 }];
    cartApi.addToCart.mockResolvedValue(updatedCartAfterAdd);
    cartApi.clearCart.mockResolvedValue([]);

    renderCart();
    await waitFor(() => expect(cartValue).not.toBeNull());

    await act(async () => {
      await cartValue.addToCart(mockProduct);
      await cartValue.clearCart();
    });

    expect(cartApi.clearCart).toHaveBeenCalled();
    expect(cartValue.cartItems).toEqual([]);
    expect(cartValue.cartCount).toBe(0);
    expect(cartValue.cartTotal).toBe(0);
  });
});
