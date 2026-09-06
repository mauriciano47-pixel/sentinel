// Gestor de rate limit ligero en memoria (Zero dependencias externas)
const requestCounts = new Map();

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Demasiadas solicitudes. Intente más tarde.' }) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const clientData = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
    } else {
      clientData.count++;
    }

    requestCounts.set(ip, clientData);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - clientData.count));

    if (clientData.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

const generalLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 120 });
const scanLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Límite de escaneos alcanzado. Espere un momento.' });

module.exports = { generalLimiter, scanLimiter };

