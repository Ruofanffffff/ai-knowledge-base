import { Card, Row, Col, Statistic, Typography, Space } from 'antd';
import { FileTextOutlined, DatabaseOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>仪表板</Title>
          <p>欢迎回来, {user?.username}!</p>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="文档总数"
                value={0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="知识图谱节点"
                value={0}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="AI 搜索次数"
                value={0}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃用户"
                value={1}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="快速开始">
          <Space direction="vertical">
            <p>• 上传文档到系统</p>
            <p>• 查看知识图谱可视化</p>
            <p>• 使用 AI 搜索功能</p>
            <p>• 管理文档和标签</p>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
