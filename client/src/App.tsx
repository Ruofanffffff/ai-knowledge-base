import React from 'react'
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Layout, Menu, Button, Input, Space } from 'antd'
import { BookOutlined, SearchOutlined, FileTextOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons'

import Home from './pages/Home'
import SearchPage from './pages/Search'
import Editor from './pages/Editor'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Settings from './pages/Settings'

const { Header, Content, Sider } = Layout
const { Search: AntSearch } = Input

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header className="header">
          <div className="logo">
            <BookOutlined style={{ fontSize: '24px', color: '#fff' }} />
            <span style={{ color: '#fff', fontSize: '20px', marginLeft: '10px' }}>个人智能知识库</span>
          </div>
          <Space style={{ marginLeft: '20px' }}>
            <AntSearch placeholder="快速搜索" allowClear style={{ width: 250 }} />
            <Button type="primary" icon={<FileTextOutlined />}>新建文档</Button>
          </Space>
        </Header>
        <Layout>
          <Sider width={200} className="site-layout-background">
            <Menu
              mode="inline"
              defaultSelectedKeys={['1']}
              style={{ height: '100%', borderRight: 0 }}
            >
              <Menu.Item key="1" icon={<BookOutlined />}>
                <Link to="/">首页</Link>
              </Menu.Item>
              <Menu.Item key="2" icon={<SearchOutlined />}>
                <Link to="/search">智能搜索</Link>
              </Menu.Item>
              <Menu.Item key="3" icon={<FileTextOutlined />}>
                <Link to="/editor">编辑器</Link>
              </Menu.Item>
              <Menu.Item key="4" icon={<DatabaseOutlined />}>
                <Link to="/graph">知识图谱</Link>
              </Menu.Item>
              <Menu.Item key="5" icon={<SettingOutlined />}>
                <Link to="/settings">设置</Link>
              </Menu.Item>
            </Menu>
          </Sider>
          <Layout style={{ padding: '0 24px 24px' }}>
            <Content
              className="site-layout-background"
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
              }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/editor/:id" element={<Editor />} />
                <Route path="/graph" element={<KnowledgeGraph />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  )
}

export default App
