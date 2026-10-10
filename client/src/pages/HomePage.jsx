import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Skeleton, Input, Button, Empty
} from 'antd';
import { SearchOutlined, ShoppingCartOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../api';
import { useTranslation } from 'react-i18next';
import './css/HomePage.css';

const { Title, Text } = Typography;

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {                                                                                                                                              //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        const latestRes = await productsApi.getAll({ page: 1, limit: 8 });
        setProducts(latestRes?.data || []);
      } catch (err) {
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <Title className="hero-title">{t('home.heroTitle')}</Title>
          <Text className="hero-subtitle">{t('home.heroSubtitle')}</Text>
          <div style={{ marginTop: '30px' }}>
            <Button type="primary" size="large" className="buy-button" onClick={() => navigate('/catalog')}>
              {t('home.shopCatalog')}
            </Button>
          </div>
        </div>
      </section>

      <div className="search-container">
        <Input
          size="large"
          placeholder={t('home.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={handleSearch}
          className="search-input"
          addonAfter={<Button type="primary" onClick={handleSearch}>{t('home.searchButton')}</Button>}
        />
      </div>

      <div className="container" style={{ padding: '40px 20px' }}>
        <div className="section-header" style={{ marginBottom: 30 }}>
          <Title level={2}><FireOutlined /> {t('home.newArrivals')}</Title>
        </div>

        {loading ? (
          <Row gutter={[24, 24]}>
            {[1, 2, 3, 4].map(i => (
              <Col key={i} xs={24} sm={12} md={6}><Skeleton active /></Col>
            ))}
          </Row>
        ) : products.length > 0 ? (
          <Row gutter={[24, 24]}>
            {products.map(item => (
              <Col key={item.id} xs={24} sm={12} md={6}>
                <Card
                  hoverable
                  cover={
                    <div style={{ height: 200, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                      <img
                        alt={item.title}
                        src={item.imageUrl || 'https://via.placeholder.com/300'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  }
                  onClick={() => navigate(`/product/${item.id}`)}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <Card.Meta title={item.title} description={`$${item.price || '99.00'}`} />
                  <Button icon={<ShoppingCartOutlined />} block style={{ marginTop: 'auto' }}>
                    {t('home.addToCart')}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description={t('home.noProducts')} />
        )}
      </div>
    </div>
  );
}
