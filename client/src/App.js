import React, { useContext } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeOutlined,
  ShoppingOutlined,
  UserOutlined,
  DashboardOutlined,
  LoginOutlined,
  LogoutOutlined,
  GlobalOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { Dropdown, Button, Space, Menu, Badge, Tooltip } from 'antd';

import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductPage from './pages/ProductPage';
import UserPage from './pages/UserPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPanel from './pages/AdminPanel';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';

import { AuthContext } from './AuthContext';
import { useCart } from './context/CartContext';
import { useTheme } from './context/ThemeContext';

import './App.css';

function App() {
  const { t, i18n } = useTranslation();
  const { token, user, logout } = useContext(AuthContext);
  const { cartCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isAdmin = user?.role === 'ADMIN';
  const showNavigation = !['/login', '/register'].includes(location.pathname);

  const languageMenu = (
    <Menu
      onClick={({ key }) => i18n.changeLanguage(key)}
      items={[
        { key: 'en', label: 'English' },
        { key: 'pt', label: 'Português' },
        { key: 'ru', label: 'Русский' },
      ]}
    />
  );

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="app-container">
      {showNavigation && (
        <header className="app-header">
          <div className="header-content">
            <Link to="/" className="app-logo">
              EXTREME GEAR
            </Link>

            <nav className="nav-menu">
              <Space size="large">
                <Link to="/" className="nav-link"><HomeOutlined /> {t('header.home') || 'Home'}</Link>
                <Link to="/catalog" className="nav-link"><ShoppingOutlined /> {t('header.catalog') || 'Catalog'}</Link>
                {token && <Link to="/orders" className="nav-link"><StarOutlined /> {t('header.myOrders') || 'Orders'}</Link>}
                {isAdmin && (
                  <Link to="/admin" className="nav-link admin-link">
                    <DashboardOutlined /> {t('header.admin') || 'Admin'}
                  </Link>
                )}
              </Space>
            </nav>

            <div className="header-actions">
              <Space size="middle">
                <Tooltip title={theme === 'light' ? t('theme.dark') : t('theme.light')}>
                  <Button
                    type="text"
                    icon={<BulbOutlined style={{ fontSize: '18px' }} />}
                    onClick={toggleTheme}
                    className="theme-toggle-btn"
                  />
                </Tooltip>

                <Dropdown overlay={languageMenu} placement="bottomRight">
                  <Button type="text" icon={<GlobalOutlined />} />
                </Dropdown>

                <Link to="/cart" className="cart-link">
                  <Badge count={cartCount} showZero offset={[10, 0]}>
                    <ShoppingCartOutlined style={{ fontSize: '22px' }} />
                  </Badge>
                </Link>

                {token ? (
                  <Space>
                    <Link to="/user" className="user-profile">
                      <UserOutlined /> <span style={{ marginLeft: 5 }}>
                        {user?.name || (user?.email ? user.email.split('@')[0] : null) || user?.id || 'User'}
                      </span>
                    </Link>
                    <Button type="text" danger icon={<LogoutOutlined />} onClick={handleLogout} className="logout-btn" />
                  </Space>
                ) : (
                  <Link to="/login">
                    <Button type="primary" icon={<LoginOutlined />}>Login</Button>
                  </Link>
                )}
              </Space>
            </div>
          </div>
        </header>
      )}

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={token ? <CartPage /> : <Navigate to="/login" replace />} />
          <Route path="/checkout" element={token ? <CheckoutPage /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={token ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route path="/user" element={token ? <UserPage /> : <Navigate to="/login" replace />} />
          <Route path="/orders" element={token ? <OrdersPage /> : <Navigate to="/login" replace />} />
          <Route path="/admin/*" element={isAdmin ? <AdminPanel /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showNavigation && (
        <footer className="app-footer">
          <p>© {new Date().getFullYear()} EXTREME GEAR SHOP. {t('footer.rights')}</p>
        </footer>
      )}
    </div>
  );
}

export default App;
