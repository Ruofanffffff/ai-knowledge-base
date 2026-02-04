import { useState } from 'react';
import { Card, Input, Button, List, Typography, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '你好！我是 AI 助手。有什么可以帮助你的吗？',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    // 模拟 AI 响应
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '这是一个模拟的 AI 响应。实际应用中，这里会调用后端 API 进行智能搜索和回答。',
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>AI 智能搜索</Title>

        <Card style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
            <List
              dataSource={messages}
              renderItem={(message) => (
                <List.Item
                  style={{
                    justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                    border: 'none',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: message.type === 'user' ? '#1890ff' : '#f0f0f0',
                      color: message.type === 'user' ? 'white' : 'black',
                    }}
                  >
                    <Text style={{ color: message.type === 'user' ? 'white' : 'black' }}>
                      {message.content}
                    </Text>
                    <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
                      {message.timestamp}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>

          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入你的问题..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isLoading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isLoading}
            >
              发送
            </Button>
          </Space.Compact>
        </Card>
      </Space>
    </div>
  );
}
