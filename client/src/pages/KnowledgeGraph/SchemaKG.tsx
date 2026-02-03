import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Slider, Switch, Space, Typography, Spin, message, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import * as d3 from 'd3';

const { Title, Text } = Typography;
const { Option } = Select;

// 定义实体类型
interface Entity {
  id: string;
  canonical_name: string;
  type: string;
  confidence: number;
  schemas: Array<{
    schema_name: string;
    confidence: number;
  }>;
  attributes?: Record<string, any>;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// 定义关系类型
interface Relation {
  id: string;
  source: string | Entity;
  target: string | Entity;
  type: string;
  subtype?: string;
  weight?: number;
  confidence: number;
}

// 定义图数据类型
interface GraphData {
  entities: Entity[];
  relations: Relation[];
}

const SchemaKG: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ entities: [], relations: [] });
  const [filteredData, setFilteredData] = useState<GraphData>({ entities: [], relations: [] });
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [showBuiltinRelations, setShowBuiltinRelations] = useState(true);
  const [showCooccurrenceRelations, setShowCooccurrenceRelations] = useState(true);
  const [showSemanticRelations, setShowSemanticRelations] = useState(true);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);

  // 获取知识图谱数据
  useEffect(() => {
    fetchKGData();
  }, []);

  // 过滤数据
  useEffect(() => {
    filterData();
  }, [graphData, confidenceThreshold, showBuiltinRelations, showCooccurrenceRelations, showSemanticRelations, selectedEntityType]);

  const fetchKGData = async () => {
    setIsLoading(true);
    try {
      // 获取实体数据
      const entitiesResponse = await fetch(`/api/knowledge-graph/entities?minConfidence=${confidenceThreshold}`);
      if (!entitiesResponse.ok) {
        throw new Error('Failed to fetch entities');
      }
      const entitiesData = await entitiesResponse.json();

      // 获取关系数据
      const relationsResponse = await fetch(`/api/knowledge-graph/relations?minConfidence=${confidenceThreshold}`);
      if (!relationsResponse.ok) {
        throw new Error('Failed to fetch relations');
      }
      const relationsData = await relationsResponse.json();

      // 提取实体类型
      const types = Array.from(new Set(entitiesData.entities.map((e: Entity) => e.type)));
      setEntityTypes(types);

      setGraphData({
        entities: entitiesData.entities || [],
        relations: relationsData.relations || []
      });
    } catch (error) {
      console.error('Error fetching KG data:', error);
      message.error('加载知识图谱数据失败');
      // 使用模拟数据作为后备
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    // 模拟数据用于开发和测试
    const mockEntities: Entity[] = [
      {
        id: 'entity_001',
        canonical_name: '阿里C区_水位下降_2025-01',
        type: 'EventEntity',
        confidence: 0.9,
        schemas: [{ schema_name: '地下水位变化事件', confidence: 0.92 }],
        attributes: { 区域: '阿里C区', 时间: '2025-01', 指标: '水位', 数值: '10', 单位: '米' }
      },
      {
        id: 'entity_002',
        canonical_name: '阿里C区',
        type: 'LocationEntity',
        confidence: 0.95,
        schemas: [{ schema_name: 'Entity-Attribute', confidence: 0.95 }],
        attributes: { 名称: '阿里C区', 类型: '区域' }
      },
      {
        id: 'entity_003',
        canonical_name: '水位监测_2025-01',
        type: 'ObservationEntity',
        confidence: 0.85,
        schemas: [{ schema_name: 'Observation', confidence: 0.87 }],
        attributes: { 时间: '2025-01', 类型: '水位监测' }
      }
    ];

    const mockRelations: Relation[] = [
      {
        id: 'rel_001',
        source: 'entity_001',
        target: 'entity_002',
        type: 'builtin',
        subtype: 'located_in',
        confidence: 0.9
      },
      {
        id: 'rel_002',
        source: 'entity_001',
        target: 'entity_003',
        type: 'co_occurrence',
        weight: 0.8,
        confidence: 0.85
      }
    ];

    setGraphData({ entities: mockEntities, relations: mockRelations });
    setEntityTypes(['EventEntity', 'LocationEntity', 'ObservationEntity']);
  };

  const filterData = () => {
    // 过滤实体
    let filteredEntities = graphData.entities.filter(e => e.confidence >= confidenceThreshold);
    
    if (selectedEntityType !== 'all') {
      filteredEntities = filteredEntities.filter(e => e.type === selectedEntityType);
    }

    // 过滤关系
    let filteredRelations = graphData.relations.filter(r => {
      if (r.confidence < confidenceThreshold) return false;
      if (r.type === 'builtin' && !showBuiltinRelations) return false;
      if (r.type === 'co_occurrence' && !showCooccurrenceRelations) return false;
      if (r.type === 'semantic' && !showSemanticRelations) return false;
      
      // 确保关系的源和目标实体都在过滤后的实体列表中
      const sourceId = typeof r.source === 'string' ? r.source : r.source.id;
      const targetId = typeof r.target === 'string' ? r.target : r.target.id;
      return filteredEntities.some(e => e.id === sourceId) && 
             filteredEntities.some(e => e.id === targetId);
    });

    setFilteredData({ entities: filteredEntities, relations: filteredRelations });
  };

  // 绘制知识图谱
  useEffect(() => {
    if (!svgRef.current || filteredData.entities.length === 0) return;

    drawGraph();
  }, [filteredData]);

  const drawGraph = () => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 600;

    // 清除之前的内容
    svg.selectAll('*').remove();

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // 创建图形组
    const g = svg.append('g');

    // 创建力导向图布局
    const simulation = d3.forceSimulation(filteredData.entities as any)
      .force('link', d3.forceLink(filteredData.relations as any)
        .id((d: any) => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(70));

    // 定义实体类型颜色映射
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['EventEntity', 'LocationEntity', 'ObservationEntity', 'ResearchEntity', 'TravelEntity', 'PhotographyEntity'])
      .range(['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']);

    // 定义关系类型颜色映射
    const relationColorScale = d3.scaleOrdinal<string>()
      .domain(['builtin', 'co_occurrence', 'semantic'])
      .range(['#1890ff', '#52c41a', '#722ed1']);

    // 创建箭头标记
    svg.append('defs').selectAll('marker')
      .data(['builtin', 'co_occurrence', 'semantic'])
      .enter().append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 35)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => relationColorScale(d));

    // 创建连接线
    const links = g.append('g')
      .selectAll('line')
      .data(filteredData.relations)
      .enter().append('line')
      .attr('stroke', d => relationColorScale(d.type))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.max(1, (d.weight || 0.5) * 3))
      .attr('marker-end', d => `url(#arrow-${d.type})`);

    // 创建关系标签
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(filteredData.relations)
      .enter().append('text')
      .text(d => d.subtype || d.type)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .attr('dy', -5);

    // 创建节点组
    const node = g.append('g')
      .selectAll('.node')
      .data(filteredData.entities)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, Entity>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // 创建节点圆
    node.append('circle')
      .attr('r', d => 20 + (d.confidence * 20))
      .attr('fill', d => colorScale(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', d => 0.7 + (d.confidence * 0.3));

    // 创建节点文本
    node.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .text(d => {
        const name = d.canonical_name;
        return name.length > 10 ? name.substring(0, 10) + '...' : name;
      })
      .attr('font-size', '12px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold');

    // 添加置信度标签
    node.append('text')
      .attr('dy', 50)
      .attr('text-anchor', 'middle')
      .text(d => `${(d.confidence * 100).toFixed(0)}%`)
      .attr('font-size', '10px')
      .attr('fill', '#666');

    // 添加节点点击事件
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(d);
    });

    // 添加节点悬停效果
    node.on('mouseover', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', (d: Entity) => 25 + (d.confidence * 20))
        .attr('stroke-width', 3);
    }).on('mouseout', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', (d: Entity) => 20 + (d.confidence * 20))
        .attr('stroke-width', 2);
    });

    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // 拖拽事件处理函数
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  return (
    <div>
      <Title level={3}>Schema 驱动知识图谱</Title>
      
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 控制面板 */}
        <Card title="图谱控制" size="small">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 置信度阈值 */}
            <div>
              <Space align="center">
                <Text>置信度阈值:</Text>
                <Tooltip title="只显示置信度高于此阈值的实体和关系">
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              </Space>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={confidenceThreshold}
                onChange={setConfidenceThreshold}
                marks={{ 0: '0%', 0.5: '50%', 1: '100%' }}
                tooltip={{ formatter: (value) => `${((value || 0) * 100).toFixed(0)}%` }}
              />
            </div>

            {/* 实体类型筛选 */}
            <div>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Text>实体类型:</Text>
              </Space>
              <Select
                value={selectedEntityType}
                onChange={setSelectedEntityType}
                style={{ width: '100%' }}
              >
                <Option value="all">全部类型</Option>
                {entityTypes.map(type => (
                  <Option key={type} value={type}>{type}</Option>
                ))}
              </Select>
            </div>

            {/* 关系类型过滤 */}
            <div>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Text>关系类型:</Text>
              </Space>
              <Space>
                <Switch
                  checked={showBuiltinRelations}
                  onChange={setShowBuiltinRelations}
                  checkedChildren="内建"
                  unCheckedChildren="内建"
                />
                <Switch
                  checked={showCooccurrenceRelations}
                  onChange={setShowCooccurrenceRelations}
                  checkedChildren="共现"
                  unCheckedChildren="共现"
                />
                <Switch
                  checked={showSemanticRelations}
                  onChange={setShowSemanticRelations}
                  checkedChildren="语义"
                  unCheckedChildren="语义"
                />
              </Space>
            </div>

            {/* 统计信息 */}
            <div>
              <Space>
                <Tag color="blue">实体: {filteredData.entities.length}</Tag>
                <Tag color="green">关系: {filteredData.relations.length}</Tag>
              </Space>
            </div>
          </Space>
        </Card>

        {/* 图谱可视化 */}
        <Card title="知识图谱可视化" size="small">
          <Spin spinning={isLoading} tip="加载知识图谱中...">
            <svg
              ref={svgRef}
              style={{
                width: '100%',
                height: '600px',
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                backgroundColor: '#fafafa'
              }}
            />
          </Spin>
        </Card>

        {/* 节点详情 */}
        {selectedNode && (
          <Card
            title={`实体详情: ${selectedNode.canonical_name}`}
            size="small"
            extra={<a onClick={() => setSelectedNode(null)}>关闭</a>}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div><Text strong>类型:</Text> {selectedNode.type}</div>
              <div><Text strong>置信度:</Text> {(selectedNode.confidence * 100).toFixed(1)}%</div>
              <div>
                <Text strong>Schema:</Text>
                <Space wrap style={{ marginTop: 4 }}>
                  {selectedNode.schemas.map((schema, idx) => (
                    <Tag key={idx} color="blue">
                      {schema.schema_name} ({(schema.confidence * 100).toFixed(0)}%)
                    </Tag>
                  ))}
                </Space>
              </div>
              {selectedNode.attributes && Object.keys(selectedNode.attributes).length > 0 && (
                <div>
                  <Text strong>属性:</Text>
                  <div style={{ marginTop: 4 }}>
                    {Object.entries(selectedNode.attributes).map(([key, value]) => (
                      <div key={key}>
                        <Text type="secondary">{key}:</Text> {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </Card>
        )}

        {/* 图例 */}
        <Card title="图例说明" size="small">
          <Space direction="vertical" size="small">
            <div>
              <Text strong>实体类型:</Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  <Tag color="#1890ff">事件实体</Tag>
                  <Tag color="#52c41a">位置实体</Tag>
                  <Tag color="#faad14">观测实体</Tag>
                  <Tag color="#f5222d">科研实体</Tag>
                  <Tag color="#722ed1">旅行实体</Tag>
                  <Tag color="#13c2c2">摄影实体</Tag>
                </Space>
              </div>
            </div>
            <div>
              <Text strong>关系类型:</Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  <Tag color="#1890ff">内建关系</Tag>
                  <Tag color="#52c41a">共现关系</Tag>
                  <Tag color="#722ed1">语义关系</Tag>
                </Space>
              </div>
            </div>
            <div>
              <Text type="secondary">节点大小表示置信度,连线粗细表示关系权重</Text>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default SchemaKG;
