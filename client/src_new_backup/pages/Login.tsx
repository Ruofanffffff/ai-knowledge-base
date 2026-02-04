import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Form, Input, Button, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: { username: string; password: string; email?: string }) => {
    setIsLoading(true);
    try {
      if (isRegister) {
        await register({
          username: values.username,
          password: values.password,
          email: values.email || `${values.username}@example.com`,
        });
        message.success('注册成功！');
      } else {
        await login({
          username: values.username,
          password: values.password,
        });
        message.success('登录成功！');
      }
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.message || (isRegister ? '注册失败' : '登录失败'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>{isRegister ? '注册账号' : '登录'}</Title>
            <Text type="secondary">AI 知识库管理系统</Text>
          </div>

          <Form
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名！' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                size="large"
              />
            </Form.Item>

            {isRegister && (
              <Form.Item
                name="email"
                rules={[
                  { type: 'email', message: '请输入有效的邮箱地址！' },
                ]}
              >
                <Input
                  placeholder="邮箱 (可选)"
                  size="large"
                />
              </Form.Item>
            )}

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码！' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                size="large"
              >
                {isRegister ? '注册' : '登录'}
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button
                type="link"
                onClick={() => setIsRegister(!isRegister)}
              >
                {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
              </Button>
            </div>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
