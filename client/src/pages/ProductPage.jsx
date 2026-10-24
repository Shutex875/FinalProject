import React, { useState, useEffect } from 'react';
import {
  Row, Col, Typography, Button, Tag,
  Divider, Space, Skeleton, message, Breadcrumb, Card
} from 'antd';
import {
  ShoppingCartOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '../api';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useAuth } from '../AuthContext';
import QuantityInput from '../components/QuantityInput';
import { getCommerceErrorMessage, isValidQuantity } from '../utils/commerce';
import LikeButton from '../components/LikeButton';
import CommentsSection from '../components/CommentsSection';
import './css/TemplatePage.css';

const { Title, Text, Paragraph } = Typography;

export default function ProductPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { token } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const data = await productsApi.getById(id);
        setProduct(data);
      } catch (err) {
        message.error(t('productPage.notFound'));
        navigate('/catalog');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, navigate, t]);

  const handleAddToCart = async () => {
    if (!product || !isValidQuantity(quantity)) return;
    if (product.stock <= 0) {
      message.error(t('products.outOfStock') || 'Out of stock');
      return;
    }
    if (quantity > product.stock) {
      message.error(t('products.notEnoughStock', { stock: product.stock }) || `Only ${product.stock} items available`);
      return;
    }
    setAdding(true);
    try {
      await addToCart(product, quantity);
      message.success(t('productPage.addedToCart', { title: product.name, quantity }));
    } catch (err) {
      const errorMsg = getCommerceErrorMessage(err, t, t('productPage.addError'));
      message.error(errorMsg);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '50px' }}>
        <Skeleton active avatar={{ size: 'large', shape: 'square' }} paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const isOutOfStock = product.stock <= 0;

  return (
    <div className="product-page-container" style={{ padding: '40px 10%', minHeight: '80vh' }}>
      <Breadcrumb style={{ marginBottom: 20 }}>
        <Breadcrumb.Item onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          {t('breadcrumb.home')}
        </Breadcrumb.Item>
        <Breadcrumb.Item onClick={() => navigate('/catalog')} style={{ cursor: 'pointer' }}>
          {t('breadcrumb.catalog')}
        </Breadcrumb.Item>
        <Breadcrumb.Item>{product.name}</Breadcrumb.Item>
      </Breadcrumb>

      <Row gutter={[48, 32]}>
        <Col xs={24} md={12}>
          <div className="product-image-main" style={{ minHeight: '300px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
            <img
              src={product.imageUrl || 'https://via.placeholder.com/600?text=Extreme+Gear'}
              alt={product.name}
              style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
            />
          </div>
        </Col>

        <Col xs={24} md={12}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Tag color="blue">{product.topic || t('productPage.defaultTag')}</Tag>
                <Title level={1} style={{ marginTop: 10, marginBottom: 0 }}>{product.name}</Title>
                <Text type="secondary">{t('productPage.idLabel')} {String(product.id).substring(0, 8)}</Text>
              </div>
              <LikeButton productId={product.id} initialCount={product.likesCount || 0} />
            </div>

            <div className="price-section">
              <Title level={2} style={{ color: '#1890ff', margin: 0 }}>
                $ {product.price || "99.00"}
              </Title>
              {isOutOfStock ? (
                <Text type="danger"><CheckCircleOutlined /> {t('productPage.outOfStock') || 'Out of stock'}</Text>
              ) : (
                <Text type="success"><CheckCircleOutlined /> {t('productPage.inStock')}</Text>
              )}
            </div>

            <Paragraph style={{ fontSize: '16px', color: '#555' }}>
              {product.description || t('productPage.defaultDescription')}
            </Paragraph>

            <Divider />

            <div className="action-area">
              <Space size="large" align="center">
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 5 }}>{t('productPage.quantityLabel')}</Text>
                  <QuantityInput
                    max={product.stock}
                    label={t('productPage.quantityLabel')}
                    value={quantity}
                    onChange={setQuantity}
                    size="large"
                    disabled={isOutOfStock || adding}
                  />
                </div>
                {token && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<ShoppingCartOutlined />}
                    onClick={handleAddToCart}
                    loading={adding}
                    disabled={isOutOfStock}
                    style={{ height: '50px', padding: '0 40px', fontWeight: 'bold' }}
                  >
                    {isOutOfStock ? (t('productPage.outOfStock') || 'Out of stock') : (t('productPage.addToCartButton'))}
                  </Button>
                )}
              </Space>
            </div>

            <Divider />

            <div>
              <Text strong>{t('productPage.tagsLabel')}</Text>
              <div style={{ marginTop: 10 }}>
                {(product.tags || ['extreme', 'professional', 'gear']).map(tag => (
                  <Tag key={tag} style={{ cursor: 'pointer' }} onClick={() => navigate(`/catalog?search=${tag}`)}>
                    #{tag}
                  </Tag>
                ))}
              </div>
            </div>

            <Card style={{ background: '#fafafa', marginTop: 20 }}>
              <Space direction="vertical">
                <Text><ThunderboltOutlined style={{ color: '#faad14' }} /> <strong>{t('productPage.freeDelivery')}</strong></Text>
                <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> <strong>{t('productPage.warranty')}</strong></Text>
              </Space>
            </Card>

            <CommentsSection productId={product.id} />

          </Space>
        </Col>
      </Row>
    </div>
  );
}
