const { requirePermission, extractBearerToken } = require('./authService');

// Mock authenClient
jest.mock('./authenClient', () => ({
  checkPermission: jest.fn(),
}));

const authenClient = require('./authenClient');

describe('requirePermission', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: 'user-123',
      headers: { authorization: 'Bearer test-token-abc' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return a middleware function', () => {
    const middleware = requirePermission('docs:read');
    expect(typeof middleware).toBe('function');
  });

  it('should call next() when user has permission', async () => {
    authenClient.checkPermission.mockResolvedValue({ has_permission: true });

    const middleware = requirePermission('docs:read');
    await middleware(req, res, next);

    expect(authenClient.checkPermission).toHaveBeenCalledWith('user-123', 'docs:read', 'test-token-abc');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks permission', async () => {
    authenClient.checkPermission.mockResolvedValue({ has_permission: false });

    const middleware = requirePermission('admin:manage');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: '权限不足' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 503 when authen service is unavailable', async () => {
    authenClient.checkPermission.mockRejectedValue(new Error('connection refused'));

    const middleware = requirePermission('docs:read');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: '认证服务暂时不可用' });
    expect(next).not.toHaveBeenCalled();
  });
});
