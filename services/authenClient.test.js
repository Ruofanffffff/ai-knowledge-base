const axios = require('axios');

// Set env vars before requiring the module
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.AUTHEN_GATEWAY_URL = 'http://test-authen:8008';
  process.env.AUTHEN_APP_ID = 'test-app-id';
  process.env.AUTHEN_APP_SECRET = 'test-app-secret';
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('AuthenClient', () => {
  let authenClient;

  beforeEach(() => {
    authenClient = require('./authenClient');
  });

  describe('constructor', () => {
    it('should read config from environment variables', () => {
      expect(authenClient.baseURL).toBe('http://test-authen:8008');
      expect(authenClient.appId).toBe('test-app-id');
      expect(authenClient.appSecret).toBe('test-app-secret');
    });

    it('should default AUTHEN_GATEWAY_URL to http://localhost:8008', () => {
      delete process.env.AUTHEN_GATEWAY_URL;
      jest.resetModules();
      const client = require('./authenClient');
      expect(client.baseURL).toBe('http://localhost:8008');
    });

    it('should create axios client with correct defaults', () => {
      expect(authenClient.client.defaults.baseURL).toBe('http://test-authen:8008');
      expect(authenClient.client.defaults.timeout).toBe(10000);
      expect(authenClient.client.defaults.headers['Content-Type']).toBe('application/json');
      expect(authenClient.client.defaults.headers['X-App-Id']).toBe('test-app-id');
      expect(authenClient.client.defaults.headers['X-App-Secret']).toBe('test-app-secret');
    });
  });

  describe('public methods existence', () => {
    const methods = [
      'registerByEmail', 'registerByPhone', 'login', 'oauthLogin',
      'refreshToken', 'getUser', 'getUserRoles', 'checkPermission', 'changePassword',
    ];

    methods.forEach(method => {
      it(`should have ${method} method`, () => {
        expect(typeof authenClient[method]).toBe('function');
      });
    });
  });

  describe('_handleError', () => {
    it('should throw service_unavailable for ECONNABORTED', () => {
      expect(() => authenClient._handleError({ code: 'ECONNABORTED' })).toThrow();
      try {
        authenClient._handleError({ code: 'ECONNABORTED' });
      } catch (err) {
        expect(err.code).toBe('service_unavailable');
        expect(err.status).toBe(503);
      }
    });

    it('should throw service_unavailable for ECONNREFUSED', () => {
      try {
        authenClient._handleError({ code: 'ECONNREFUSED' });
      } catch (err) {
        expect(err.code).toBe('service_unavailable');
        expect(err.status).toBe(503);
      }
    });

    it('should extract error_code and message from response data', () => {
      try {
        authenClient._handleError({
          response: {
            status: 400,
            data: { error_code: 'invalid_email', message: '邮箱格式不正确' },
          },
        });
      } catch (err) {
        expect(err.code).toBe('invalid_email');
        expect(err.message).toBe('邮箱格式不正确');
        expect(err.status).toBe(400);
      }
    });

    it('should use defaults when error_code or message missing', () => {
      try {
        authenClient._handleError({
          response: { status: 500, data: {} },
        });
      } catch (err) {
        expect(err.code).toBe('unknown_error');
        expect(err.message).toBe('认证服务错误');
        expect(err.status).toBe(500);
      }
    });

    it('should throw service_unavailable for unknown errors', () => {
      try {
        authenClient._handleError(new Error('network error'));
      } catch (err) {
        expect(err.code).toBe('service_unavailable');
        expect(err.status).toBe(503);
      }
    });
  });
});
