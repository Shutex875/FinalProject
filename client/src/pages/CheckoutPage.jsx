import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Row, Col, Radio } from 'antd';
import { useCart } from '../context/CartContext';
import { useAuth } from '../AuthContext';
import { ordersApi } from '../api';
import { getCommerceErrorMessage } from '../utils/commerce';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const DELIVERY_COST = 5;
const FREE_DELIVERY_THRESHOLD = 200;
const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card'
};

export default function CheckoutPage() {
  const { cartItems, cartTotal, loadCart } = useCart();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH);

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/checkout' } });
    } else if (!cartItems.length && !loading) {
      navigate('/cart');
    }
  }, [token, navigate, cartItems.length, loading]);

  if (!token) {
    return null;
  }

  if (cartItems.length === 0) return null;

  const deliveryCost = cartTotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_COST : 0;
  const finalTotal = cartTotal + deliveryCost;

  const onFinish = async (values) => {
    if (loading) return;
    const paymentText = paymentMethod === PAYMENT_METHODS.CASH
      ? t('checkout.paymentCash')
      : t('checkout.paymentCard');
    const fullComment = values.comment
      ? `${values.comment}\n${t('checkout.paymentMethodLabel')}: ${paymentText}`
      : `${t('checkout.paymentMethodLabel')}: ${paymentText}`;

    const orderData = {
      address: values.address,
      phone: values.phone,
      comment: fullComment,
    };

    setLoading(true);
    try {
      await ordersApi.create(orderData);
      message.success(t('checkout.orderPlaced', { payment: paymentText }));
      navigate('/orders');
      // Checkout already clears the server cart atomically; only refresh local state.
      await loadCart();
    } catch (err) {
      message.error(getCommerceErrorMessage(err, t, t('checkout.error')));
    } finally {
      setLoading(false);
    }
  };

  // Валидация имени
  const validateName = (_, value) => {
    if (!value || value.trim().length < 3) {
      return Promise.reject(new Error(t('checkout.nameMinLength') || 'Имя должно содержать не менее 3 символов'));
    }
    if (!/^[A-Za-zА-Яа-яЁё\s]+$/.test(value)) {
      return Promise.reject(new Error(t('checkout.nameInvalid') || 'Имя может содержать только буквы и пробелы'));
    }
    return Promise.resolve();
  };

  // Валидация email
  const validateEmail = (_, value) => {
    if (!value) {
      return Promise.reject(new Error(t('checkout.emailRequired') || 'Email обязателен'));
    }
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return Promise.reject(new Error(t('checkout.emailInvalid') || 'Введите корректный email'));
    }
    return Promise.resolve();
  };

  // Валидация адреса – должен содержать хотя бы одну букву, не состоять только из цифр/спецсимволов
  const validateAddress = (_, value) => {
    if (!value || value.trim().length < 5) {
      return Promise.reject(new Error(t('checkout.addressMinLength') || 'Адрес должен содержать не менее 5 символов'));
    }
    const hasLetter = /[A-Za-zА-Яа-я]/.test(value);
    if (!hasLetter) {
      return Promise.reject(new Error(t('checkout.addressInvalid') || 'Адрес должен содержать хотя бы одну букву'));
    }
    return Promise.resolve();
  };

  // Валидация телефона – любое количество цифр (не менее 10) после удаления всех не-цифр
  const validatePhone = (_, value) => {
    if (!value) {
      return Promise.reject(new Error(t('checkout.phoneRequired') || 'Телефон обязателен'));
    }
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return Promise.reject(new Error(t('checkout.phoneDigitsMin') || 'Номер телефона должен содержать минимум 10 цифр'));
    }
    return Promise.resolve();
  };

  return (
    <div style={{ padding: '40px 50px', maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}>{t('checkout.title') || 'Оформление заказа'}</Title>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title={t('checkout.shippingInfo') || 'Информация о доставке'}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                name: user?.name || '',
                email: user?.email || '',
              }}
            >
              <Form.Item
                name="name"
                label={t('checkout.fullName') || 'Полное имя'}
                rules={[{ validator: validateName }]}
              >
                <Input size="large" />
              </Form.Item>
              <Form.Item
                name="email"
                label={t('common.email') || 'Email'}
                rules={[{ validator: validateEmail }]}
              >
                <Input size="large" />
              </Form.Item>
              <Form.Item
                name="address"
                label={t('checkout.address') || 'Адрес'}
                rules={[{ validator: validateAddress }]}
              >
                <Input.TextArea rows={2} size="large" />
              </Form.Item>
              <Form.Item
                name="phone"
                label={t('checkout.phone') || 'Телефон'}
                rules={[{ validator: validatePhone }]}
              >
                <Input size="large" placeholder="+375 29 1234567" />
              </Form.Item>
              <Form.Item name="comment" label={t('checkout.comment') || 'Комментарий (опционально)'}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item label={t('checkout.paymentMethod') || 'Способ оплаты'}>
                <Radio.Group onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                  <Radio value={PAYMENT_METHODS.CASH}>{t('checkout.paymentCash')}</Radio>
                  <Radio value={PAYMENT_METHODS.CARD}>{t('checkout.paymentCard')}</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                  {t('checkout.placeOrder') || 'Заказать'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('checkout.orderSummary') || 'Сводка заказа'}>
            {cartItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>{item.name} x{item.quantity}</Text>
                <Text>${(Number(item.price) * item.quantity).toFixed(2)}</Text>
              </div>
            ))}
            <Text type="secondary">{t('checkout.estimatedTotal', { defaultValue: 'Предварительная сумма. Окончательная стоимость рассчитывается при оформлении заказа.' })}</Text>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text>{t('checkout.subtotal') || 'Подитог'}:</Text>
              <Text>${cartTotal.toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text>{t('checkout.delivery') || 'Доставка'}:</Text>
              <Text>{deliveryCost > 0 ? `$${deliveryCost.toFixed(2)}` : t('checkout.freeDelivery')}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text strong>{t('checkout.total') || 'Итого'}:</Text>
              <Text strong>${finalTotal.toFixed(2)}</Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
