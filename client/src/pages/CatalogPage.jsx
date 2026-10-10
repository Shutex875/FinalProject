import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Row, Col, Card, Input, Select, Typography, Button, Breadcrumb, Skeleton, Empty, Tag, message, Slider, Pagination } from 'antd';
import { SearchOutlined, ShoppingCartOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsApi } from '../api';
import { useCart } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import LikeButton from '../components/LikeButton';
import './css/TemplatePage.css';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

export default function CatalogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [addingProductId, setAddingProductId] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get('search') || '');
    setCategory(params.get('cat') || '');
    setMinPrice(params.has('minPrice') ? Number(params.get('minPrice')) : 0);
    setMaxPrice(params.has('maxPrice') ? Number(params.get('maxPrice')) : 1000);
    setSortBy(params.get('sortBy') || 'newest');
    setCurrentPage(params.has('page') ? Number(params.get('page')) : 1);
    setPageSize(params.has('limit') ? Number(params.get('limit')) : 12);
  }, [location.search]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(location.search);
      const apiParams = {
        search: params.get('search') || undefined,
        category: params.get('cat') || undefined,
        minPrice: params.has('minPrice') ? Number(params.get('minPrice')) : undefined,
        maxPrice: params.has('maxPrice') ? Number(params.get('maxPrice')) : undefined,
        sortBy: params.get('sortBy') || undefined,
        page: params.get('page') || 1,
        limit: params.get('limit') || 12,
      };
      const res = await productsApi.getAll(apiParams);
      setProducts(res.data || []);
      setTotal(res.total || 0);
      setCurrentPage(res.page || 1);
      setPageSize(res.limit || 12);
    } catch (err) {
      console.error("Failed to fetch products", err);
      message.error(t('catalog.fetchError') || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [location.search, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (key, value) => {                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    const params = new URLSearchParams(location.search);
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    navigate(`/catalog?${params.toString()}`);                                                                                     //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  };

  const handlePriceChange = (values) => {
    const params = new URLSearchParams(location.search);
    if (values[0] > 0) params.set('minPrice', values[0]);
    else params.delete('minPrice');
    if (values[1] < 1000) params.set('maxPrice', values[1]);
    else params.delete('maxPrice');
    params.delete('page');
    navigate(`/catalog?${params.toString()}`);
  };

  const handleSortChange = (value) => {
    handleFilterChange('sortBy', value);
  };

  const handlePageChange = (page, pageSize) => {
    const params = new URLSearchParams(location.search);
    params.set('page', page);
    if (pageSize !== 12) params.set('limit', pageSize);
    else params.delete('limit');
    navigate(`/catalog?${params.toString()}`);
  };

  const handleAddToCart = async (item, e) => {
    e.stopPropagation();
    if (!item.stock || item.stock <= 0) {
      message.error(t('products.outOfStock') || 'Out of stock');
      return;
    }
    setAddingProductId(item.id);
    try {
      await addToCart(item, 1);
      message.success(t('catalog.addedToCart', { name: item.name }));
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === item.id ? { ...p, stock: p.stock - 1 } : p
        )
      );
    } catch (err) {
      const errorMsg = err.response?.data?.error || t('cart.addError') || 'Failed to add to cart';
      message.error(errorMsg);
    } finally {
      setAddingProductId(null);
    }
  };

  const isOutOfStock = (stock) => !stock || stock <= 0;

  return (
    <Layout className="catalog-layout" style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
      <Content style={{ padding: '24px 50px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            {t('breadcrumb.home')}
          </Breadcrumb.Item>
          <Breadcrumb.Item>{t('breadcrumb.catalog')}</Breadcrumb.Item>
        </Breadcrumb>

        <Row gutter={[32, 32]}>
          <Col xs={24} md={6}>
            <Card
              title={<span style={{ fontWeight: 800 }}><FilterOutlined /> {t('catalog.filtersTitle')}</span>}
              bordered={false}
              style={{ borderRadius: '12px', boxShadow: 'var(--shadow)' }}
            >
              <div style={{ marginBottom: 24 }}>
                <Text strong>{t('catalog.searchLabel')}</Text>
                <Input
                  placeholder={t('catalog.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onPressEnter={() => handleFilterChange('search', search)}
                  allowClear
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <Text strong>{t('catalog.categoryLabel')}</Text>
                <Select
                  style={{ width: '100%' }}
                  value={category || undefined}
                  onChange={(val) => handleFilterChange('cat', val)}
                  placeholder={t('catalog.categoryPlaceholder')}
                  allowClear
                >
                  <Option value="Skateboards">{t('catalog.catSkateboards')}</Option>
                  <Option value="Longboards">{t('catalog.catLongboards')}</Option>
                  <Option value="Footwear">{t('catalog.catFootwear')}</Option>
                  <Option value="Hardware">{t('catalog.catHardware')}</Option>
                  <Option value="Apparel">{t('catalog.catApparel')}</Option>
                  <Option value="Accessories">{t('catalog.catAccessories')}</Option>
                </Select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <Text strong>{t('catalog.priceRangeLabel')}</Text>
                <Slider
                  range
                  min={0}
                  max={1000}
                  value={[minPrice, maxPrice]}
                  onChange={(val) => { setMinPrice(val[0]); setMaxPrice(val[1]); }}
                  onAfterChange={handlePriceChange}
                  tipFormatter={(v) => `$${v}`}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>${minPrice}</Text>
                  <Text>${maxPrice}</Text>
                </div>
              </div>
              <Button type="primary" block size="large" onClick={() => handleFilterChange('search', search)}>
                {t('catalog.applyFiltersButton')}
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={18}>
            <div className="catalog-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={4}>{t('catalog.showingItems', { count: products.length, total })}</Title>
              <Select value={sortBy} onChange={handleSortChange} style={{ width: 180 }}>
                <Option value="newest">{t('catalog.sortNewest')}</Option>
                <Option value="price_asc">{t('catalog.sortPriceAsc')}</Option>
                <Option value="price_desc">{t('catalog.sortPriceDesc')}</Option>
              </Select>
            </div>

            {loading ? (
              <Row gutter={[20, 20]}>
                {[1,2,3,4,5,6].map(i => <Col key={i} xs={24} sm={12} lg={8}><Card><Skeleton active /></Card></Col>)}
              </Row>
            ) : products.length > 0 ? (
              <>
                <Row gutter={[20, 20]}>
                  {products.map(item => {
                    const outOfStock = isOutOfStock(item.stock);
                    return (
                      <Col key={item.id} xs={24} sm={12} lg={8}>
                        <Card hoverable
                          cover={
                            <div style={{ position: 'relative' }}>
                              <img alt={item.name} src={item.imageUrl || 'https://via.placeholder.com/300'} style={{ height: 240, objectFit: 'cover', width: '100%' }} />
                              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
                                <LikeButton productId={item.id} initialCount={item.likesCount || 0} />
                              </div>
                            </div>
                          }
                          onClick={() => navigate(`/product/${item.id}`)}
                        >
                          <Tag color="blue">{item.brand || t('catalog.defaultBrand')}</Tag>
                          {item.stock !== undefined && (
                            <Tag color={item.stock > 0 ? 'green' : 'red'} style={{ marginLeft: 5 }}>
                              {item.stock > 0 ? `${item.stock} left` : t('products.outOfStock')}
                            </Tag>
                          )}
                          <Title level={5}>{item.name}</Title>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 20, color: 'var(--accent-color)' }}>${Number(item.price).toFixed(2)}</Text>
                            <Button
                              type="primary"
                              shape="circle"
                              icon={<ShoppingCartOutlined />}
                              onClick={(e) => handleAddToCart(item, e)}
                              loading={addingProductId === item.id}
                              disabled={outOfStock}
                            />
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={total}
                    onChange={handlePageChange}
                    showSizeChanger
                    pageSizeOptions={[12, 24, 48]}
                  />
                </div>
              </>
            ) : (
              <Empty description={t('catalog.noProducts')} />
            )}
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}
