import React, { useEffect, useState } from 'react';
import { Card, List, Typography, Tag, Space, Input, Select, Pagination, Spin, message, Drawer, Descriptions, Button } from 'antd';
import { FileTextOutlined, SearchOutlined, FilterOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

// 定义 CKB 类型
interface CKB {
  id: string;
  doc_id: string;
  source_type: string;
  source_meta: {
    file_name?: string;
    page?: number;
    sheet_name?: string;
    row?: number;
  };
  structure: {
    section_title?: string;
    level?: number;
  };
  content: {
    text: string;
    language?: string;
  };
  quality: {
    source_confidence: number;
  };
  timestamps: {
    created_at: string;
  };
}

const CKBExplorer: React.FC = () => {
  const [ckbs, setCkbs] = useState<CKB[]>([]);
  const [filteredCkbs, setFilteredCkbs] = useState<CKB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedCkb, setSelectedCkb] = useState<CKB | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [sourceTypes, setSourceTypes] = useState<string[]>([]);

  // 获取 CKB 数据
  useEffect(() => {
    fetchCKBs();
  }, []);

  // 过滤 CKB
  useEffect(() => {
    filterCKBs();
  }, [ckbs, searchQuery, selectedSourceType]);

  const fetchCKBs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge-graph/ckb');
      if (!response.ok) {
        throw new Error('Failed to fetch CKBs');
      }
      const data = await response.json();
      
      // 提取源类型
      const types = Array.from(new Set(data.ckbs.map((c: CKB) => c.source_type))) as string[];
      setSourceTypes(types);
      
      setCkbs(data.ckbs || []);
    } catch (error) {
      console.error('Error fetching CKBs:', error);
      message.error('加载 CKB 数据失败');
      // 使用模拟数据作为后备
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    const mockCkbs: CKB[] = [
      {
        id: 'ckb_001',
        doc_id: 'doc_123',
        source_type: 'pdf',
        source_meta: {
          file_name: 'report.pdf',
          page: 5
        },
        structure: {
          section_title: '3.2 数据分析',
          level: 2
        },
        content: {
          text: '阿里C区2025年1月水位下降10米',
          language: 'zh'
        },
        quality: {
          source_confidence: 0.9
        },
        timestamps: {
          created_at: '2025-01-26T10:00:00Z'
        }
      },
      {
        id: 'ckb_002',
        doc_id: 'doc_124',
        source_type: 'word',
        source_meta: {
          file_name: 'meeting_notes.docx'
        },
        structure: {
          section_title: '会议记录',
          level: 1
        },
        content: {
          text: '讨论了水位监测方案的实施细节',
          language: 'zh'
        },
        quality: {
          source_confidence: 0.85
        },
        timestamps: {
          created_at: '2025-01-25T14:30:00Z'
        }
      },
      {
        id: 'ckb_003',
        doc_id: 'doc_125',
        source_type: 'excel',
        source_meta: {
          file_name: 'data.xlsx',
          sheet_name: 'Sheet1',
          row: 10
        },
        structure: {},
        content: {
          text: '区域: 阿里C区, 时间: 2025-01, 水位: -10米',
          language: 'zh'
        },
        quality: {
          source_confidence: 0.95
        },
        timestamps: {
          created_at: '2025-01-24T09:15:00Z'
        }
      }
    ];

    setCkbs(mockCkbs);
    setSourceTypes(['pdf', 'word', 'excel']);
  };

  const filterCKBs = () => {
    let filtered = ckbs;

    // 按源类型过滤
    if (selectedSourceType !== 'all') {
      filtered = filtered.filter(c => c.source_type === selectedSourceType);
    }

    // 按搜索关键词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.content.text.toLowerCase().includes(query) ||
        c.source_meta.file_name?.toLowerCase().includes(query) ||
        c.structure.section_title?.toLowerCase().includes(query)
      );
    }

    setFilteredCkbs(filtered);
    setCurrentPage(1); // 重置到第一页
  };

  const handleCkbClick = (ckb: CKB) => {
    setSelectedCkb(ckb);
    setDrawerVisible(true);
  };

  const handleJumpToDocument = (docId: string) => {
    // 跳转到源文档
    message.info(`跳转到文档: ${docId}`);
    // 实际实现中应该导航到编辑器页面
    // window.location.href = `#/editor/${docId}`;
  };

  const getSourceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'pdf': 'red',
      'word': 'blue',
      'excel': 'green',
      'image': 'orange',
      'video': 'purple'
    };
    return colors[type] || 'default';
  };

  const getSourceTypeIcon = (_type: string) => {
    return <FileTextOutlined />;
  };

  // 分页数据
  const paginatedCkbs = filteredCkbs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div>
      <Title level={3}>CKB 浏览器</Title>
      <Text type="secondary">浏览和搜索知识图谱的最小事实单元 (CKB)</Text>

      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
        {/* 搜索和过滤 */}
        <Card size="small">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Search
              placeholder="搜索 CKB 内容、文件名或章节标题..."
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={setSearchQuery}
            />

            <Space>
              <FilterOutlined />
              <Text>源类型:</Text>
              <Select
                value={selectedSourceType}
                onChange={setSelectedSourceType}
                style={{ width: 150 }}
              >
                <Option value="all">全部类型</Option>
                {sourceTypes.map(type => (
                  <Option key={type} value={type}>
                    {type.toUpperCase()}
                  </Option>
                ))}
              </Select>
              <Tag color="blue">共 {filteredCkbs.length} 条 CKB</Tag>
            </Space>
          </Space>
        </Card>

        {/* CKB 列表 */}
        <Card size="small">
          <Spin spinning={isLoading} tip="加载 CKB 数据中...">
            <List
              itemLayout="vertical"
              dataSource={paginatedCkbs}
              locale={{ emptyText: '暂无 CKB 数据' }}
              renderItem={(ckb) => (
                <List.Item
                  key={ckb.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCkbClick(ckb)}
                  extra={
                    <Space direction="vertical" align="end">
                      <Tag color={getSourceTypeColor(ckb.source_type)} icon={getSourceTypeIcon(ckb.source_type)}>
                        {ckb.source_type.toUpperCase()}
                      </Tag>
                      <Tag color="green">
                        置信度: {(ckb.quality.source_confidence * 100).toFixed(0)}%
                      </Tag>
                    </Space>
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{ckb.structure.section_title || '无标题'}</Text>
                        {ckb.source_meta.file_name && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ({ckb.source_meta.file_name})
                          </Text>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Paragraph
                          ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                          style={{ marginBottom: 0 }}
                        >
                          {ckb.content.text}
                        </Paragraph>
                        <Space size="small">
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ID: {ckb.id}
                          </Text>
                          {ckb.source_meta.page && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              | 页码: {ckb.source_meta.page}
                            </Text>
                          )}
                          {ckb.source_meta.sheet_name && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              | 工作表: {ckb.source_meta.sheet_name}
                            </Text>
                          )}
                          {ckb.source_meta.row && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              | 行: {ckb.source_meta.row}
                            </Text>
                          )}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />

            {/* 分页 */}
            {filteredCkbs.length > pageSize && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredCkbs.length}
                  onChange={setCurrentPage}
                  showSizeChanger={false}
                  showTotal={(total) => `共 ${total} 条`}
                />
              </div>
            )}
          </Spin>
        </Card>
      </Space>

      {/* CKB 详情抽屉 */}
      <Drawer
        title="CKB 详情"
        placement="right"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          selectedCkb && (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => handleJumpToDocument(selectedCkb.doc_id)}
            >
              跳转到源文档
            </Button>
          )
        }
      >
        {selectedCkb && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基本信息 */}
            <Card title="基本信息" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="CKB ID">{selectedCkb.id}</Descriptions.Item>
                <Descriptions.Item label="文档 ID">{selectedCkb.doc_id}</Descriptions.Item>
                <Descriptions.Item label="源类型">
                  <Tag color={getSourceTypeColor(selectedCkb.source_type)}>
                    {selectedCkb.source_type.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="置信度">
                  <Tag color="green">
                    {(selectedCkb.quality.source_confidence * 100).toFixed(1)}%
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(selectedCkb.timestamps.created_at).toLocaleString('zh-CN')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 源元数据 */}
            <Card title="源元数据" size="small">
              <Descriptions column={1} size="small">
                {selectedCkb.source_meta.file_name && (
                  <Descriptions.Item label="文件名">
                    {selectedCkb.source_meta.file_name}
                  </Descriptions.Item>
                )}
                {selectedCkb.source_meta.page && (
                  <Descriptions.Item label="页码">
                    {selectedCkb.source_meta.page}
                  </Descriptions.Item>
                )}
                {selectedCkb.source_meta.sheet_name && (
                  <Descriptions.Item label="工作表">
                    {selectedCkb.source_meta.sheet_name}
                  </Descriptions.Item>
                )}
                {selectedCkb.source_meta.row && (
                  <Descriptions.Item label="行号">
                    {selectedCkb.source_meta.row}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* 结构信息 */}
            {(selectedCkb.structure.section_title || selectedCkb.structure.level) && (
              <Card title="结构信息" size="small">
                <Descriptions column={1} size="small">
                  {selectedCkb.structure.section_title && (
                    <Descriptions.Item label="章节标题">
                      {selectedCkb.structure.section_title}
                    </Descriptions.Item>
                  )}
                  {selectedCkb.structure.level && (
                    <Descriptions.Item label="层级">
                      {selectedCkb.structure.level}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {/* 内容 */}
            <Card title="内容" size="small">
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {selectedCkb.content.text}
              </Paragraph>
              {selectedCkb.content.language && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  语言: {selectedCkb.content.language}
                </Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default CKBExplorer;
