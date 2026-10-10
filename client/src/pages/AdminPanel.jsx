import React, { useState, useEffect } from 'react';
import {
  Table, Typography, Space, Input, Button,
  Row, Col, Select, Tag, Popconfirm, message, Tabs, InputNumber, Modal, Form, Upload
} from 'antd';
import {
  UserSwitchOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, LockOutlined, UnlockOutlined,
  ShoppingOutlined, DollarOutlined, PlusOutlined, UploadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import './css/AdminPanel.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const ROLE_OPTIONS = ['ADMIN', 'CUSTOMER'];
const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const statusColors = {
  PENDING: 'orange',
  PROCESSING: 'blue',
  SHIPPED: 'cyan',
  DELIVERED: 'green',
  CANCELLED: 'red'
};

export default function AdminPanel() {
  const { t } = useTranslation();

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPagination, setUsersPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsSearch, setProductsSearch] = useState('');
  const [productsPagination, setProductsPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [updatingStock, setUpdatingStock] = useState(null);
  const [categories, setCategories] = useState([]);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [addProductForm] = Form.useForm();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // ==================== USERS ====================
  const fetchUsers = async (params = {}) => {
    setUsersLoading(true);
    try {
      const response = await adminApi.getUsers({
        page: params.current || usersPagination.current,
        limit: params.pageSize || usersPagination.pageSize,
        search: params.search !== undefined ? params.search : usersSearch
      });
      setUsers(response.data);
      setUsersPagination({
        ...usersPagination,
        total: response.pagination.total,
        current: response.pagination.page
      });
    } catch (err) {
      message.error(t('admin.loadError') || 'Error loading users');
    } finally {
      setUsersLoading(false);
    }
  };

  // ==================== PRODUCTS ====================
  const fetchProducts = async (params = {}) => {
    setProductsLoading(true);
    try {
      const response = await adminApi.getProducts({
        page: params.current || productsPagination.current,
        limit: params.pageSize || productsPagination.pageSize,
        search: params.search !== undefined ? params.search : productsSearch
      });
      setProducts(response.data);
      setProductsPagination({
        ...productsPagination,
        total: response.pagination.total,
        current: response.pagination.page
      });
    } catch (err) {
      message.error('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await adminApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const handleUpdateStock = async (id, newStock) => {
    if (newStock === undefined || newStock < 0) return;
    setUpdatingStock(id);
    try {
      await adminApi.updateProductStock(id, newStock);
      message.success('Stock updated successfully');
      fetchProducts();
    } catch (err) {
      message.error('Failed to update stock');
    } finally {
      setUpdatingStock(null);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await adminApi.deleteProduct(id);
      message.success('Product deleted');
      fetchProducts();
    } catch (err) {
      message.error('Failed to delete product');
    }
  };

  const handleAddProduct = async (values) => {
    try {
      const productData = {
        name: values.name,
        brand: values.brand,
        price: values.price,
        stock: values.stock,
        categoryId: values.categoryId,
        description: values.description,
        imageUrl: uploadedImageUrl,
      };
      await adminApi.createProduct(productData);
      message.success('Product created');
      setAddProductModalVisible(false);
      addProductForm.resetFields();
      setUploadedImageUrl('');
      fetchProducts();
    } catch (err) {
      message.error('Failed to create product');
    }
  };

  const handleUploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    setUploadingImage(true);
    try {
      const res = await adminApi.uploadImage(formData);
      setUploadedImageUrl(res.imageUrl);
      message.success('Image uploaded');
    } catch (err) {
      message.error('Upload failed');
    } finally {
      setUploadingImage(false);
    }
    return false; // prevent auto upload
  };

  // ==================== ORDERS ====================
  const fetchOrders = async (params = {}) => {
    setOrdersLoading(true);
    try {
      const response = await adminApi.getOrders({
        page: params.current || ordersPagination.current,
        limit: params.pageSize || ordersPagination.pageSize,
      });
      setOrders(response.data);
      setOrdersPagination({
        ...ordersPagination,
        total: response.pagination.total,
        current: response.pagination.page
      });
    } catch (err) {
      message.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    setUpdatingStatus(id);
    try {
      await adminApi.updateOrderStatus(id, newStatus);
      message.success('Order status updated');
      fetchOrders();
    } catch (err) {
      message.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteOrder = async (id) => {
    try {
      await adminApi.deleteOrder(id);
      message.success('Order deleted successfully');
      fetchOrders();
    } catch (err) {
      message.error('Failed to delete order');
    }
  };

  // Load initial admin data once when the panel mounts.
  // These functions are also used by event handlers for subsequent refreshes.
  useEffect(() => {
    fetchUsers();
    fetchProducts();
    fetchOrders();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== РАЗВОРАЧИВАЮЩАЯСЯ СТРОКА ЗАКАЗА ====================
  const renderOrderDetails = (record) => {
    const deliveryCost = record.total < 200 ? 5 : 0;
    return (
      <div style={{ padding: '12px 20px', background: '#fafafa' }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Items:</Text>
        {record.items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text>{item.product?.name || `Product #${item.productId}`}</Text>
            <Text>{item.quantity} x ${Number(item.price).toFixed(2)} = ${(item.quantity * Number(item.price)).toFixed(2)}</Text>
          </div>
        ))}
        <div style={{ marginTop: 10, borderTop: '1px solid #e8e8e8', paddingTop: 8 }}>
          <Text type="secondary">Delivery: {deliveryCost > 0 ? `$${deliveryCost}` : 'Free'}</Text>
        </div>
      </div>
    );
  };

  // ==================== COLUMNS ====================
  const userColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id) => <Text code>#{id}</Text> },
    { title: t('admin.name') || 'Name', dataIndex: 'name', key: 'name', render: (text, record) => (
      <Space><div className={`role-dot ${record.role.toLowerCase()}`} /><Text strong={record.role === 'ADMIN'}>{text}</Text></Space>
    ) },
    { title: t('admin.email') || 'Email', dataIndex: 'email', key: 'email' },
    { title: t('admin.role') || 'Role', dataIndex: 'role', key: 'role', render: (role, record) => (
      <Select size="small" value={role} style={{ width: 120 }} onChange={(value) => {
        adminApi.updateUserRole(record.id, value).then(() => fetchUsers()).catch(() => message.error('Failed'));
      }}>{ROLE_OPTIONS.map(r => <Option key={r} value={r}>{r}</Option>)}</Select>
    ) },
    { title: t('admin.status') || 'Status', dataIndex: 'isBlocked', key: 'status', render: (isBlocked) => (
      <Tag color={isBlocked ? 'red' : 'green'}>{isBlocked ? t('admin.blocked') : t('admin.active')}</Tag>
    ) },
    { title: t('admin.actions') || 'Actions', key: 'actions', render: (_, record) => (
      <Space>
        <Button size="small" icon={record.isBlocked ? <UnlockOutlined /> : <LockOutlined />} onClick={() => {
          adminApi.toggleUserBlock(record.id, !record.isBlocked).then(() => fetchUsers());
        }} danger={!record.isBlocked} />
        <Popconfirm title={t('admin.deleteConfirm')} onConfirm={() => adminApi.deleteUser(record.id).then(() => fetchUsers())}>
          <Button size="small" type="primary" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) }
  ];

  const productColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (id) => <Text code>#{id}</Text> },
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text, record) => (
      <Space><img src={record.imageUrl} alt={text} style={{ width: 40, height: 40, objectFit: 'cover' }} /><Text strong>{text}</Text></Space>
    ) },
    { title: 'Brand', dataIndex: 'brand', key: 'brand' },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (price) => `$${Number(price).toFixed(2)}` },
    { title: 'Stock', dataIndex: 'stock', key: 'stock', render: (stock, record) => (
      <Space>
        <InputNumber min={0} value={stock} onChange={(value) => handleUpdateStock(record.id, value)} disabled={updatingStock === record.id} />
        {updatingStock === record.id && <Text type="secondary">Updating...</Text>}
      </Space>
    ) },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete this product?"
          onConfirm={() => handleDeleteProduct(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button size="small" type="primary" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  const orderColumns = [
    { title: 'Order ID', dataIndex: 'id', key: 'id', render: (id) => <Text code>#{id}</Text> },
    { title: 'Customer', key: 'customer', render: (_, record) => <Text>{record.user?.name || record.user?.email || 'N/A'}</Text> },
    { title: 'Total', dataIndex: 'total', key: 'total', render: (total) => `$${Number(total).toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status, record) => (
      <Select value={status} style={{ width: 140 }} onChange={(value) => handleUpdateStatus(record.id, value)} disabled={updatingStatus === record.id}>
        {ORDER_STATUSES.map(s => <Option key={s} value={s}><Tag color={statusColors[s]}>{s}</Tag></Option>)}
      </Select>
    ) },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (date) => new Date(date).toLocaleDateString() },
    {
      title: t('admin.actions') || 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete this order?"
          onConfirm={() => handleDeleteOrder(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button size="small" type="primary" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="admin-panel-container">
      <div className="admin-glass-header">
        <Row justify="space-between" align="middle">
          <Col><Space size="middle"><div className="header-icon-box"><UserSwitchOutlined /></div>
            <div><Title level={2} style={{ margin: 0 }}>{t('admin.title') || 'Admin Panel'}</Title>
            <Text type="secondary">{t('admin.subtitle') || 'System Administration'}</Text></div>
          </Space></Col>
        </Row>
      </div>

      <Tabs defaultActiveKey="users" size="large" style={{ marginTop: 24 }}>
        <TabPane tab={<span><UserSwitchOutlined /> Users</span>} key="users">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Input placeholder="Search users..." prefix={<SearchOutlined />} value={usersSearch} onChange={(e) => setUsersSearch(e.target.value)} onPressEnter={() => fetchUsers({ search: usersSearch, current: 1 })} /></Col>
            <Col><Button icon={<ReloadOutlined />} onClick={() => fetchUsers()} loading={usersLoading} /></Col>
          </Row>
          <Table columns={userColumns} dataSource={users} loading={usersLoading} rowKey="id" pagination={{ ...usersPagination, onChange: (page, pageSize) => fetchUsers({ current: page, pageSize }) }} />
        </TabPane>

        <TabPane tab={<span><ShoppingOutlined /> Products</span>} key="products">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Input placeholder="Search products..." prefix={<SearchOutlined />} value={productsSearch} onChange={(e) => setProductsSearch(e.target.value)} onPressEnter={() => fetchProducts({ search: productsSearch, current: 1 })} /></Col>
            <Col><Button icon={<ReloadOutlined />} onClick={() => fetchProducts()} loading={productsLoading} /></Col>
            <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddProductModalVisible(true)}>Add Product</Button></Col>
          </Row>
          <Table columns={productColumns} dataSource={products} loading={productsLoading} rowKey="id" pagination={{ ...productsPagination, onChange: (page, pageSize) => fetchProducts({ current: page, pageSize }) }} />
        </TabPane>

        <TabPane tab={<span><DollarOutlined /> Orders</span>} key="orders">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col><Button icon={<ReloadOutlined />} onClick={() => fetchOrders()} loading={ordersLoading} /></Col>
          </Row>
          <Table
            columns={orderColumns}
            dataSource={orders}
            loading={ordersLoading}
            rowKey="id"
            expandable={{
              expandedRowRender: renderOrderDetails,
              rowExpandable: (record) => record.items && record.items.length > 0
            }}
            pagination={{ ...ordersPagination, onChange: (page, pageSize) => fetchOrders({ current: page, pageSize }) }}
          />
        </TabPane>
      </Tabs>

      {/* Modal for adding product */}
      <Modal
        title="Add New Product"
        open={addProductModalVisible}
        onCancel={() => {
          setAddProductModalVisible(false);
          addProductForm.resetFields();
          setUploadedImageUrl('');
        }}
        footer={null}
        width={600}
      >
        <Form form={addProductForm} layout="vertical" onFinish={handleAddProduct}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="brand" label="Brand">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="Price" rules={[{ required: true, message: 'Price is required' }, { type: 'number', min: 0 }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label="Stock" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category">
              {categories.map(cat => <Option key={cat.id} value={cat.id}>{cat.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Product Image">
            <Upload
              beforeUpload={handleUploadImage}
              showUploadList={false}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} loading={uploadingImage}>Upload Image</Button>
            </Upload>
            {uploadedImageUrl && <img src={uploadedImageUrl} alt="preview" style={{ width: 100, marginTop: 10 }} />}
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Create Product</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
