const axios = require('axios');

class AuthenClient {
  constructor() {
    this.baseURL = process.env.AUTHEN_GATEWAY_URL || 'http://localhost:8008';
    this.appId = process.env.AUTHEN_APP_ID;
    this.appSecret = process.env.AUTHEN_APP_SECRET;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': this.appId,
        'X-App-Secret': this.appSecret,
      },
    });
  }

  _handleError(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
      throw { code: 'service_unavailable', message: '认证服务暂时不可用', status: 503 };
    }
    if (error.response) {
      const { error_code, message, detail } = error.response.data;
      const msg = message || detail || '认证服务错误';
      throw { code: error_code || 'unknown_error', message: msg, status: error.response.status };
    }
    throw { code: 'service_unavailable', message: '认证服务暂时不可用', status: 503 };
  }

  async registerByEmail(data) {
    try {
      const response = await this.client.post('/api/v1/gateway/auth/register/email', data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async registerByPhone(data) {
    try {
      const response = await this.client.post('/api/v1/gateway/auth/register/phone', data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async login(data) {
    try {
      const response = await this.client.post('/api/v1/gateway/auth/login', data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async oauthLogin(provider, data) {
    try {
      const response = await this.client.post(`/api/v1/gateway/auth/oauth/${provider}`, data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async refreshToken(data) {
    try {
      const response = await this.client.post('/api/v1/gateway/auth/refresh', data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getUser(userId, token) {
    try {
      const response = await this.client.get(`/api/v1/gateway/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getUserRoles(userId, token) {
    try {
      const response = await this.client.get(`/api/v1/gateway/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async checkPermission(userId, permissionCode, token) {
    try {
      const response = await this.client.post(
        `/api/v1/gateway/users/${userId}/permissions/check`,
        { permission_code: permissionCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async changePassword(data, token) {
    try {
      const response = await this.client.post('/api/v1/gateway/auth/change-password', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }
}

module.exports = new AuthenClient();
