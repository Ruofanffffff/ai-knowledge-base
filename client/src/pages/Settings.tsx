import React, { useState } from 'react'
import { Card, Space, Typography, Switch, Input, Button, Select, Slider, Upload, Divider } from 'antd'
import { SaveOutlined, UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const { Option } = Select

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    darkMode: false,
    autoSave: true,
    defaultEditor: 'markdown',
    fontSize: 16,
    aiFeatures: true,
    searchThreshold: 0.7,
    dataPath: '/Users/user/Documents/knowledge-base'
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    setIsSaving(true)
    // 模拟保存延迟
    setTimeout(() => {
      setIsSaving(false)
      alert('设置已保存')
    }, 500)
  }

  return (
    <div>
      <Title level={2}>系统设置</Title>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card title="外观设置" style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>深色模式</Text>
              <Switch checked={settings.darkMode} onChange={(checked) => handleSettingChange('darkMode', checked)} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>字体大小</Text>
              <Slider
                min={12}
                max={24}
                value={settings.fontSize}
                onChange={(value) => handleSettingChange('fontSize', value)}
                marks={{ 12: '12px', 16: '16px', 24: '24px' }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text>{settings.fontSize}px</Text>
            </div>
          </Space>
        </Card>

        <Card title="编辑设置" style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>自动保存</Text>
              <Switch checked={settings.autoSave} onChange={(checked) => handleSettingChange('autoSave', checked)} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>默认编辑器</Text>
              <Select
                value={settings.defaultEditor}
                onChange={(value) => handleSettingChange('defaultEditor', value)}
                style={{ width: 150 }}
              >
                <Option value="markdown">Markdown</Option>
                <Option value="rich">富文本</Option>
                <Option value="plain">纯文本</Option>
              </Select>
            </div>
          </Space>
        </Card>

        <Card title="AI功能设置" style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>启用AI功能</Text>
              <Switch checked={settings.aiFeatures} onChange={(checked) => handleSettingChange('aiFeatures', checked)} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>搜索相似度阈值</Text>
              <Slider
                min={0.1}
                max={1}
                step={0.1}
                value={settings.searchThreshold}
                onChange={(value) => handleSettingChange('searchThreshold', value)}
                marks={{ 0.1: '0.1', 0.5: '0.5', 1: '1.0' }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text>{settings.searchThreshold.toFixed(1)}</Text>
            </div>
          </Space>
        </Card>

        <Card title="数据管理" style={{ width: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>数据存储路径</Text>
              <Input value={settings.dataPath} style={{ width: 300 }} />
            </div>
            
            <Divider />
            
            <Space wrap>
              <Upload action="#" beforeUpload={() => false}>
                <Button icon={<UploadOutlined />}>导入数据</Button>
              </Upload>
              <Button icon={<DeleteOutlined />} danger>清空数据</Button>
              <Button icon={<EyeOutlined />}>查看数据</Button>
            </Space>
          </Space>
        </Card>

        <Card style={{ width: '100%', textAlign: 'right' }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={isSaving} size="large">
            保存设置
          </Button>
        </Card>
      </Space>
    </div>
  )
}

export default Settings