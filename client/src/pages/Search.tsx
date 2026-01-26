import React, { useState } from 'react'
import { Card, Input, Button, List, Space, Tag, Typography, Tabs, Radio } from 'antd'
import { SearchOutlined, FileTextOutlined, BookOutlined, DatabaseOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Search: InputSearch } = Input
const { Title, Text } = Typography
const { TabPane } = Tabs
const { Group: RadioGroup } = Radio

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('semantic') // semantic, keyword
  const [results, setResults] = useState<any[]>([])

  // 模拟搜索结果
  const mockResults = [
    { id: '1', title: 'React学习笔记', content: 'React是一个用于构建用户界面的JavaScript库...', score: 0.92, type: 'document', tags: ['前端', 'React'] },
    { id: '2', title: 'React Hooks详解', content: 'Hooks是React 16.8中新增的特性...', score: 0.85, type: 'document', tags: ['前端', 'React'] },
    { id: '3', title: '组件化开发思想', content: '组件化是前端开发的重要思想...', score: 0.78, type: 'concept', tags: ['前端', '架构'] },
  ]

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    // 模拟搜索延迟
    setTimeout(() => {
      setResults(mockResults)
    }, 500)
  }

  return (
    <div>
      <Title level={2}>智能搜索</Title>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <InputSearch
              placeholder="输入搜索内容..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
            
            <RadioGroup defaultValue="semantic" onChange={(e) => setSearchType(e.target.value)}>
              <Radio.Button value="semantic">语义搜索</Radio.Button>
              <Radio.Button value="keyword">关键词搜索</Radio.Button>
            </RadioGroup>
          </Space>
        </Card>

        {searchQuery && (
          <Card title={`搜索结果 (${results.length})`} style={{ width: '100%' }}>
            <Tabs defaultActiveKey="1">
              <TabPane tab="所有结果" key="1">
                <List
                  dataSource={results}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button size="small" icon={<FileTextOutlined />}>查看</Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          item.type === 'document' ? <FileTextOutlined /> : 
                          item.type === 'concept' ? <BookOutlined /> : <DatabaseOutlined />
                        }
                        title={<Link to={`/editor/${item.id}`}>{item.title}</Link>}
                        description={
                          <Space direction="vertical" size="small">
                            <Text ellipsis={{ rows: 2, expandable: false }}>{item.content}</Text>
                            <div>
                              <Tag color="blue">相关性: {item.score.toFixed(2)}</Tag>
                              {item.tags.map(tag => (
                                <Tag key={tag}>{tag}</Tag>
                              ))}
                            </div>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </TabPane>
              <TabPane tab="文档" key="2">
                <List
                  dataSource={results.filter(item => item.type === 'document')}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Link to={`/editor/${item.id}`}>{item.title}</Link>}
                        description={<Text ellipsis={{ rows: 2, expandable: false }}>{item.content}</Text>}
                      />
                    </List.Item>
                  )}
                />
              </TabPane>
              <TabPane tab="概念" key="3">
                <List
                  dataSource={results.filter(item => item.type === 'concept')}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Link to={`/concept/${item.id}`}>{item.title}</Link>}
                        description={<Text ellipsis={{ rows: 2, expandable: false }}>{item.content}</Text>}
                      />
                    </List.Item>
                  )}
                />
              </TabPane>
            </Tabs>
          </Card>
        )}
      </Space>
    </div>
  )
}

export default SearchPage
