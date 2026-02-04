import { useState } from 'react';
import { Card, Table, Button, Space, Typography, Upload, message } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title } = Typography;

export default function Documents() {
  const [documents] = useState([
    {
      id: '1',
      name: '示例文档.pdf',
      size: '2.5 MB',
      uploadDate: '2024-02-04',
      status: '已处理',
    },
  ]);

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '上传日期',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">查看</Button>
          <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/upload',
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>文档管理</Title>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />}>
              上传文档
            </Button>
          </Upload>
        </div>

        <Card>
          <Table
            columns={columns}
            dataSource={documents}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>
    </div>
  );
}
