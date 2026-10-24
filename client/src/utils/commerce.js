export const isValidQuantity = (value) => Number.isInteger(value) && value >= 1 && value <= 99;

export const getCommerceErrorMessage = (error, t, fallback) => {
  const status = error.status || error.response?.status;
  const serverMessage = error.response?.data?.error || error.response?.data?.message || error.message;
  if (status === 403) {
    return t('commerce.accountBlocked', { defaultValue: 'Аккаунт заблокирован или недоступен' });
  }
  if ([400, 409].includes(status) && /stock|склад|estoque/i.test(serverMessage || '')) {
    return t('commerce.insufficientStock', { defaultValue: 'Недостаточно товара на складе. Измените количество в корзине.' });
  }
  return serverMessage || fallback;
};
