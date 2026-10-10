import React, { useState, useEffect, useCallback } from 'react';
import { Table, Typography, Tag, Spin, Empty, message } from 'antd';
import { useAuth } from '../AuthContext';
import { ordersApi } from '../api';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function OrdersPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getMyOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      message.error(t('orders.loadError') || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token, fetchOrders]);

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING':
        return t('orders.statusPending');
      case 'COMPLETED':
        return t('orders.statusCompleted');
      case 'CANCELLED':
        return t('orders.statusCancelled');
      case 'DELIVERED':
        return t('orders.statusDrlivered');
      default:
        return status;
    }
  };

  const columns = [
    {
      title: t('orders.orderId') || 'Order ID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text code>#{id}</Text>,
    },
    {
      title: t('orders.date') || 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: t('orders.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'PENDING' ? 'orange' : status === 'COMPLETED' ? 'green' : 'red'}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: t('orders.total') || 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total) => `$${Number(total).toFixed(2)}`,
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Empty description={t('orders.noOrders') || 'You have no orders yet'} />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 50px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>{t('orders.title') || 'My Orders'}</Title>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <p><strong>{t('orders.address') || 'Address'}:</strong> {record.address}</p>
              <p><strong>{t('orders.phone') || 'Phone'}:</strong> {record.phone}</p>
              {record.comment && <p><strong>{t('orders.comment') || 'Comment'}:</strong> {record.comment}</p>}
              <hr />
              <Text strong>{t('orders.items') || 'Items'}:</Text>
              {record.items.map(item => (
                <div key={item.id} style={{ marginTop: 8 }}>
                  <Text>{item.product?.name || `${t('orders.productPrefix')} ${item.productId}`}</Text> - {item.quantity} {t('orders.quantitySeparator')} ${item.price}
                </div>
              ))}
            </div>
          ),
        }}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
