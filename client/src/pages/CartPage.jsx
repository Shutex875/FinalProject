import React, { useEffect } from 'react';
import { Table, Button, InputNumber, Typography, Space, Empty, Card, Row, Col, message, Popconfirm } from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';

const { Title, Text } = Typography;

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useAuth();

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
        <InputNumber
          min={1}
          max={99}
          value={record.quantity}
          onChange={(value) => updateQuantity(record.id, value - record.quantity)}
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
          onConfirm={() => removeFromCart(record.id)}
          okText={t('common.yes') || 'Yes'}
          cancelText={t('common.no') || 'No'}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      message.warning(t('cart.emptyWarning') || 'Your cart is empty');
      return;
    }
    navigate('/checkout');
  };

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
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('cart.summary') || 'Order Summary'}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{t('cart.totalItems') || 'Total items'}:</Text>
                <Text strong>{cartItems.reduce((sum, i) => sum + i.quantity, 0)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{t('cart.subtotal') || 'Subtotal'}:</Text>
                <Text strong>${cartTotal.toFixed(2)}</Text>
              </div>
              <Button type="primary" size="large" block onClick={handleCheckout} icon={<ShoppingOutlined />}>
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
