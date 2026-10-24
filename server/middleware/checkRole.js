export default (allowedRoles) => {
  if (!Array.isArray(allowedRoles)) {
    throw new Error('O parâmetro allowedRoles deve ser um array');
  }

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Autenticação necessária' });
      }

      if (req.user.isBlocked) {
        return res.status(403).json({ error: 'Conta bloqueada' });
      }

      const userRole = req.user.role || 'CUSTOMER';
      const hasRequiredRole = allowedRoles.includes(userRole);

      if (!hasRequiredRole) {
        console.warn(`[Access Denied]: User ${req.user.email} (${userRole}) attempted to access ${req.originalUrl}`);

        return res.status(403).json({
          error: 'Permissões insuficientes para executar esta ação',
          requiredRoles: allowedRoles,
          yourRole: userRole
        });
      }

      next();
    } catch (error) {
      console.error('Erro ao verificar permissões de acesso:', error);
      res.status(500).json({ error: 'Erro interno ao verificar permissões de acesso' });
    }
  };
};
