import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'splitease-dev-secret';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function generateToken(user) {
  return jwt.sign(
    {
      uid: user.id || user.uid,
      email: user.email || null,
      displayName: user.display_name || user.displayName || null,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
