import React, { useEffect } from 'react';
import { Table, Button, Typography, Space, Empty, Card, Row, Col, message, Popconfirm, Spin } from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';

import useInFlightLock from '../hooks/useInFlightLock';
import QuantityInput from '../components/QuantityInput';
import { getCommerceErrorMessage } from '../utils/commerce';

const { Title, Text } = Typography;

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartCount, loading } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();
  const [updating, runMutation] = useInFlightLock();
  const busy = updating || loading;

  const handleQuantityChange = (record, quantity) => runMutation(async () => {
    try {
      await updateQuantity(record.id, quantity - record.quantity);
    } catch (error) {
      message.error(getCommerceErrorMessage(error, t, t('cart.updateError', { defaultValue: 'Не удалось обновить корзину' })));
    }
  });

  const handleRemove = (productId) => runMutation(async () => {
    try {
      await removeFromCart(productId);
    } catch (error) {
      message.error(getCommerceErrorMessage(error, t, t('cart.updateError', { defaultValue: 'Не удалось обновить корзину' })));
    }
  });

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/cart' } });
    }
  }, [token, navigate]);

  if (!token) {
    return null;
  }

  const columns = [
    {
      title: t('cart.product') || 'Product',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.brand && <div><Text type="secondary">{record.brand}</Text></div>}
        </div>
      ),
    },
    {
      title: t('cart.price') || 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `$${Number(price).toFixed(2)}`,
    },
    {
      title: t('cart.quantity') || 'Quantity',
      key: 'quantity',
      render: (_, record) => (
        <QuantityInput
          value={record.quantity}
          label={t('cart.quantity')}
          disabled={busy}
          onChange={(value) => handleQuantityChange(record, value)}
        />
      ),
    },
    {
      title: t('cart.total') || 'Total',
      key: 'total',
      render: (_, record) => `$${(Number(record.price) * record.quantity).toFixed(2)}`,
    },
    {
      title: t('cart.actions') || 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title={t('cart.removeConfirm') || 'Remove this item?'}
          onConfirm={() => handleRemove(record.id)}
          disabled={busy}
          okButtonProps={{ disabled: busy, loading: updating }}
          okText={t('common.yes') || 'Yes'}
          cancelText={t('common.no') || 'No'}
        >
          <Button type="text" danger disabled={busy} icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const handleCheckout = () => {
    if (busy) return;
    if (cartItems.length === 0) {
      message.warning(t('cart.emptyWarning') || 'Your cart is empty');
      return;
    }
    navigate('/checkout');
  };

  if (loading && cartItems.length === 0) {
    return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <Empty description={t('cart.empty') || 'Your cart is empty'} />
        <Button type="primary" onClick={() => navigate('/catalog')} style={{ marginTop: 20 }}>
          {t('cart.continueShopping') || 'Continue Shopping'}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 50px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>{t('cart.title') || 'Shopping Cart'}</Title>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Table
            columns={columns}
            dataSource={cartItems}
            rowKey="id"
            pagination={false}
            loading={busy}
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('cart.summary') || 'Order Summary'}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{t('cart.totalItems') || 'Total items'}:</Text>
                <Text strong>{cartCount}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{t('cart.subtotal') || 'Subtotal'}:</Text>
                <Text strong>${cartTotal.toFixed(2)}</Text>
              </div>
              <Button type="primary" size="large" block onClick={handleCheckout} disabled={busy} icon={<ShoppingOutlined />}>
                {t('cart.checkout') || 'Proceed to Checkout'}
              </Button>
              <Button onClick={() => navigate('/catalog')}>
                {t('cart.continueShopping') || 'Continue Shopping'}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
