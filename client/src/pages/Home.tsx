import React from 'react'
import { Card, List, Typography, Button, Space, Tag } from 'antd'
import { PlusOutlined, FileTextOutlined, BookOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

const Home: React.FC = () => {
  // 模拟数据
  const recentDocuments = [
    { id: '1', title: 'React学习笔记', content: 'React是一个用于构建用户界面的JavaScript库...', createdAt: '2026-01-10', tags: ['前端', 'React'] },
    { id: '2', title: 'SQLite数据库使用指南', content: 'SQLite是一个轻量级的关系型数据库...', createdAt: '2026-01-09', tags: ['数据库', 'SQLite'] },
    { id: '3', title: 'AI语义搜索原理', content: '语义搜索是基于自然语言理解的搜索技术...', createdAt: '2026-01-08', tags: ['AI', '搜索'] },
  ]

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>欢迎使用个人智能知识库</Title>
          <Button type="primary" icon={<PlusOutlined />}>新建文档</Button>
        </div>

        <Card title="最近文档" style={{ width: '100%' }}>
          <List
            dataSource={recentDocuments}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" icon={<FileTextOutlined />}>编辑</Button>,
                  <Button size="small" icon={<SearchOutlined />}>搜索</Button>
                ]}
              >
                <List.Item.Meta
                  title={<Link to={`/editor/${item.id}`}>{item.title}</Link>}
                  description={
                    <Space direction="vertical" size="small">
                      <Text ellipsis={{ rows: 2, expandable: false }}>{item.content}</Text>
                      <div>
                        {item.tags.map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                      <Text type="secondary">创建时间: {item.createdAt}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="快速访问" style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button type="default" icon={<SearchOutlined />} block size="large">
              智能搜索
            </Button>
            <Button type="default" icon={<FileTextOutlined />} block size="large">
              新建文档
            </Button>
            <Button type="default" icon={<BookOutlined />} block size="large">
              查看知识库
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default Home
