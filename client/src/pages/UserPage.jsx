import React, { useState, useEffect } from 'react';
import {
  Tabs, Card, Tag, Space, Button, Typography, Empty, message,
  Avatar, Row, Col, Modal, Form, Input, Popconfirm
} from 'antd';
import {
  UserOutlined, ShoppingOutlined, EditOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { authApi, likesApi } from '../api';
import { useTranslation } from 'react-i18next';
import useInFlightLock from '../hooks/useInFlightLock';
import TemplateCard from '../components/TemplateCard';
import './css/UserPage.css';

const { Title, Text } = Typography;

export default function UserPage() {
  const { t } = useTranslation();
  const { user, updateUser, deactivateAccount } = useAuth();
  const [deactivating, runDeactivation] = useInFlightLock();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [likedProducts, setLikedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLikedProducts = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const response = await likesApi.getUserLikes();
        setLikedProducts(response);
      } catch (err) {
        console.error('Fetch likes error:', err);
        message.error(t('user.loadLikesError') || 'Failed to load favorites');
      } finally {
        setLoading(false);
      }
    };
    fetchLikedProducts();
  }, [user, t]);

  const handleDeactivate = () => runDeactivation(async () => {
    try {
      await deactivateAccount();
      message.success(t('user.deactivated', { defaultValue: 'Аккаунт деактивирован. Доступ закрыт, история заказов сохранена.' }));
      navigate('/login', { replace: true });
    } catch (error) {
      message.error(error.message || t('user.deactivateError', { defaultValue: 'Не удалось деактивировать аккаунт' }));
    }
  });

  const getRoleTranslation = (role) => {
    switch (role) {
      case 'ADMIN': return t('user.roleAdmin');
      case 'CUSTOMER': return t('user.roleCustomer');
      default: return role || t('user.roleUser');
    }
  };

  const showEditModal = () => {
    form.setFieldsValue({ name: user?.name || '' });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async (values) => {
    setSubmitting(true);
    try {
      const updatedUser = await authApi.updateProfile({ name: values.name });
      if (updateUser) {
        updateUser(updatedUser.user);
      } else {
        window.location.reload();
      }
      message.success(t('user.profileUpdated'));
      setEditModalVisible(false);
    } catch (err) {
      message.error(err.message || t('user.updateError'));
    } finally {
      setSubmitting(false);
    }
  };

  const tabItems = [
    {
      key: '1',
      label: (<span><ShoppingOutlined /> {t('user.favorites')}</span>),
      children: (
        <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
          {loading ? (
            [1, 2, 3].map(i => <Col key={i} span={8}><Card loading /></Col>)
          ) : likedProducts.length > 0 ? (
            likedProducts.map(product => (
              <Col key={product.id} xs={24} sm={12} md={8}>
                <TemplateCard template={product} />
              </Col>
            ))
          ) : (
            <Col span={24}>
              <Empty description={t('user.noFavorites')} style={{ padding: '40px 0' }}>
                <Button type="primary" onClick={() => navigate('/catalog')}>
                  {t('user.goToCatalog')}
                </Button>
              </Empty>
            </Col>
          )}
        </Row>
      )
    }
  ];

  return (
    <div className="user-profile-page" style={{ padding: '40px 50px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card
        bordered={false}
        style={{
          background: '#141414',
          borderRadius: '16px',
          marginBottom: '30px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }}
      >
        <Row gutter={24} align="middle">
          <Col>
            <Avatar
              size={100}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff' }}
            />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              {user?.name?.toUpperCase() || t('user.defaultName')}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.65)' }}>{user?.email}</Text>
            <div style={{ marginTop: '8px' }}>
              <Tag color="gold">{t('user.proRider')}</Tag>
              <Tag color="blue">{getRoleTranslation(user?.role)}</Tag>
            </div>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={showEditModal}
              disabled={deactivating}
            >
              {t('user.editProfile')}
            </Button>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Popconfirm
          title={t('user.deactivateTitle', { defaultValue: 'Деактивировать аккаунт?' })}
          description={t('user.deactivateWarning', { defaultValue: 'Деактивация необратима. Доступ к аккаунту будет закрыт, а история заказов сохранена.' })}
          onConfirm={handleDeactivate}
          disabled={deactivating || submitting}
          okText={t('user.deactivate', { defaultValue: 'Деактивировать аккаунт' })}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true, loading: deactivating, disabled: deactivating }}
        >
          <Button danger loading={deactivating} disabled={deactivating || submitting}>
            {t('user.deactivate', { defaultValue: 'Деактивировать аккаунт' })}
          </Button>
        </Popconfirm>
      </Card>

      <Tabs defaultActiveKey="1" items={tabItems} size="large" />

      <Modal
        title={t('user.editProfile')}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label={t('user.name')}
            rules={[
              { required: true, message: t('user.nameRequired') },
              { min: 2, message: t('user.nameMinLength') }
            ]}
          >
            <Input placeholder={t('user.namePlaceholder')} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('common.save')}
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
