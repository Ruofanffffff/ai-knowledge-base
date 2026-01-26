import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Input, Button, Space, Tag, Select, Tooltip, Spin, message } from 'antd'
import { SaveOutlined, UndoOutlined, RedoOutlined, TagOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'

const { Title } = Input
const { Option } = Select

const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [title, setTitle] = useState('新建文档')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 从URL参数获取文档ID并加载内容
  useEffect(() => {
    if (id) {
      const fetchDocument = async () => {
        setIsLoading(true)
        try {
          const response = await fetch(`http://localhost:3000/api/documents/${id}`)
          if (!response.ok) {
            throw new Error('Failed to fetch document')
          }
          const data = await response.json()
          setTitle(data.title || '新建文档')
          setContent(data.content || '')
          setTags(data.metadata?.tags || [])
          message.success('文档加载成功')
        } catch (error) {
          console.error('Error fetching document:', error)
          message.error('文档加载失败')
        } finally {
          setIsLoading(false)
        }
      }
      fetchDocument()
    }
  }, [id])

  // 模拟标签建议
  useEffect(() => {
    if (content.length > 100) {
      // 模拟AI标签建议
      setTimeout(() => {
        setSuggestedTags(['AI', '智能搜索', '知识库', '技术'])  
      }, 1000)
    }
  }, [content])

  const handleSave = () => {
    setIsSaving(true)
    // 模拟保存延迟
    setTimeout(() => {
      setIsSaving(false)
      alert('文档已保存')
    }, 500)
  }

  const handleAddTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <div>
      <Spin spinning={isLoading} indicator={<LoadingOutlined spin />} tip="加载文档中...">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Title
              placeholder="输入文档标题"
              value={title}
              onChange={setTitle}
              level={3}
              allowClear
              autoSize
            />

            <Space wrap>
              {tags.map(tag => (
                <Tag key={tag} closable onClose={() => handleRemoveTag(tag)}>
                  {tag}
                </Tag>
              ))}
              {suggestedTags.length > 0 && (
                <Select
                  mode="tags"
                  placeholder="选择或输入标签"
                  style={{ width: 'auto' }}
                  onChange={handleAddTag}
                  options={suggestedTags.map(tag => ({ value: tag, label: tag }))}
                />
              )}
            </Space>

            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip title="撤销">
                <Button icon={<UndoOutlined />} disabled />
              </Tooltip>
              <Tooltip title="重做">
                <Button icon={<RedoOutlined />} disabled />
              </Tooltip>
              <Tooltip title="AI标签建议">
                <Button icon={<TagOutlined />} disabled={suggestedTags.length === 0} />
              </Tooltip>
              <Tooltip title="预览">
                <Button icon={<EyeOutlined />} />
              </Tooltip>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={isSaving}>
                保存
              </Button>
            </Space>
          </Space>
        </Card>

        <Card style={{ width: '100%', minHeight: '500px' }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入文档内容..."
            style={{
              width: '100%',
              height: '500px',
              padding: '16px',
              fontSize: '16px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              resize: 'vertical',
              fontFamily: 'monospace'
            }}
          />
        </Card>

        {suggestedTags.length > 0 && (
          <Card title="AI标签建议" style={{ width: '100%' }}>
            <Space wrap>
              {suggestedTags.map(tag => (
                <Tag
                  key={tag}
                  color="blue"
                  onClick={() => handleAddTag(tag)}
                  style={{ cursor: 'pointer' }}
                >
                  {tag}
                </Tag>
              ))}
            </Space>
            <p style={{ marginTop: '10px', color: '#666', fontSize: '12px' }}>
              点击标签可快速添加到文档
            </p>
          </Card>
        )}
      </Space>
      </Spin>
    </div>
  )
}

export default Editor