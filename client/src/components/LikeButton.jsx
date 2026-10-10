import React, { useState, useEffect } from 'react';
import { Button, Tooltip, Spin, message } from 'antd';
import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import { likesApi } from '../api';
import { useTranslation } from 'react-i18next';

// Кэш для статусов лайков (глобальный объект)
const likeCache = {};

export default function LikeButton({ productId, initialCount }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialCount ? false : false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(initialCount || 0);

  useEffect(() => {
    // Если пользователь не залогинен, не делаем запрос
    if (!productId || !user) return;

    // Проверяем кэш
    if (likeCache[productId] !== undefined) {
      setLiked(likeCache[productId].liked);
      setCount(likeCache[productId].count);
      return;
    }

    const fetchLikeStatus = async () => {
      try {
        setLoading(true);
        const response = await likesApi.getLikeStatus(productId);
        const data = { liked: response.liked, count: response.count };
        // Сохраняем в кэш
        likeCache[productId] = data;
        setLiked(data.liked);
        setCount(data.count);
      } catch (err) {
        console.error('Erro ao obter status do like:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLikeStatus();
  }, [user, productId]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      message.info(t('likes.loginRequired') || 'Faça login para adicionar aos favoritos');
      return;
    }

    if (!productId) return;

    // Оптимистичное обновление
    const newLiked = !liked;
    setLiked(newLiked);
    setCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      setLoading(true);
      const response = await likesApi.toggleLike(productId);
      // Обновляем кэш
      likeCache[productId] = { liked: response.liked, count: response.count };
      setLiked(response.liked);
      setCount(response.count);

      if (response.liked) {
        message.success(t('likes.added') || 'Adicionado aos favoritos');
      }
    } catch (err) {
      // Откат при ошибке
      setLiked(!newLiked);
      setCount(prev => !newLiked ? prev + 1 : prev - 1);
      console.error('Erro ao alternar like:', err);
      message.error(t('likes.updateError') || 'Falha ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const tooltipText = !user
    ? (t('likes.loginRequired') || 'Faça login na sua conta')
    : liked
      ? (t('likes.unlike') || 'Remover dos favoritos')
      : (t('likes.like') || 'Adicionar aos favoritos');

  return (
    <div className="like-button-wrapper" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Tooltip title={tooltipText}>
        <Button
          type="text"
          shape="circle"
          icon={
            loading ? (
              <Spin size="small" />
            ) : liked ? (
              <HeartFilled style={{ color: '#ff4d4f', fontSize: '20px' }} />
            ) : (
              <HeartOutlined style={{ fontSize: '20px' }} />
            )
          }
          onClick={handleLike}
          disabled={loading}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        />
      </Tooltip>
      {count > 0 && (
        <span style={{ marginLeft: 4, fontSize: 14, color: '#999' }}>{count}</span>
      )}
    </div>
  );
}
