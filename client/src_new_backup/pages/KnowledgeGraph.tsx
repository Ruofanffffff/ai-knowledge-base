import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Space, Typography, Input, Slider, Spin, Tabs } from 'antd'
import { SearchOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined } from '@ant-design/icons'
import * as d3 from 'd3'
import SchemaKG from './KnowledgeGraph/SchemaKG'
import CKBExplorer from './KnowledgeGraph/CKBExplorer'

const { Title, Text } = Typography
const { Search } = Input

// 定义实体和关系类型
interface Entity {
  id: string;
  name: string;
  type: string;
  value?: number;
}

interface Relation {
  source: string;
  target: string;
  type: string;
}

const KnowledgeGraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [_searchQuery, setSearchQuery] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // 模拟知识图谱数据
  useEffect(() => {
    setIsLoading(true)
    // 模拟加载延迟
    setTimeout(() => {
      const mockEntities: Entity[] = [
        { id: '1', name: '人工智能', type: 'concept', value: 100 },
        { id: '2', name: '机器学习', type: 'concept', value: 80 },
        { id: '3', name: '深度学习', type: 'concept', value: 70 },
        { id: '4', name: '神经网络', type: 'concept', value: 60 },
        { id: '5', name: '语义搜索', type: 'concept', value: 90 },
        { id: '6', name: '知识图谱', type: 'concept', value: 85 },
        { id: '7', name: 'React', type: 'technology', value: 95 },
        { id: '8', name: 'Electron', type: 'technology', value: 85 },
      ]

      const mockRelations: Relation[] = [
        { source: '1', target: '2', type: '包含' },
        { source: '2', target: '3', type: '包含' },
        { source: '3', target: '4', type: '包含' },
        { source: '1', target: '5', type: '应用' },
        { source: '1', target: '6', type: '应用' },
        { source: '5', target: '6', type: '相关' },
        { source: '7', target: '8', type: '相关' },
      ]

      setEntities(mockEntities)
      setRelations(mockRelations)
      setIsLoading(false)
    }, 1000)
  }, [])

  // 绘制知识图谱
  useEffect(() => {
    if (!svgRef.current || entities.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = 600

    // 清除之前的内容
    svg.selectAll('*').remove()

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoom)

    // 创建图形组
    const g = svg.append('g')

    // 创建力导向图布局
    const simulation = d3.forceSimulation(entities as any)
      .force('link', d3.forceLink(relations as any).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60))

    // 定义实体类型颜色映射
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(['concept', 'technology', 'project', 'person', 'book'])

    // 创建连接线
    const links = g.append('g')
      .selectAll('line')
      .data(relations)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)

    // 创建关系标签
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(relations)
      .enter().append('text')
      .text(d => d.type)
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')

    // 创建节点组
    const node = g.append('g')
      .selectAll('.node')
      .data(entities)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, Entity>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    // 创建节点圆
    node.append('circle')
      .attr('r', d => Math.max(20, Math.min(40, (d.value || 50) / 5)))
      .attr('fill', d => colorScale(d.type) || '#ccc')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // 创建节点文本
    node.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .text(d => d.name)
      .attr('font-size', '14px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')

    // 添加节点点击事件
    node.on('click', (_event, d) => {
      console.log('Node clicked:', d)
      // 可以显示节点详情
      alert(`节点: ${d.name}\n类型: ${d.type}`)
    })

    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2)

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // 拖拽事件处理函数
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
  }, [entities, relations])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    // 模拟搜索过滤
    if (value) {
      // 这里可以根据搜索条件过滤实体
      console.log('搜索:', value)
    }
  }

  const handleZoomIn = () => {
    if (zoomLevel < 4) {
      const newZoom = zoomLevel + 0.1
      setZoomLevel(newZoom)
      d3.select(svgRef.current).transition().duration(200).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any, 
        d3.zoomIdentity.scale(newZoom)
      )
    }
  }

  const handleZoomOut = () => {
    if (zoomLevel > 0.1) {
      const newZoom = zoomLevel - 0.1
      setZoomLevel(newZoom)
      d3.select(svgRef.current).transition().duration(200).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any, 
        d3.zoomIdentity.scale(newZoom)
      )
    }
  }

  return (
    <div>
      <Title level={2}>知识图谱</Title>
      
      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: '基础视图',
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Card style={{ width: '100%' }}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Search
                      placeholder="搜索实体..."
                      allowClear
                      enterButton={<SearchOutlined />}
                      size="middle"
                      onSearch={handleSearch}
                      style={{ width: '100%' }}
                    />
                    
                    <Space style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>放大</Button>
                        <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>缩小</Button>
                        <Button icon={<FullscreenOutlined />}>全屏</Button>
                      </Space>
                      <Slider
                        min={0.1}
                        max={4}
                        step={0.1}
                        value={zoomLevel}
                        onChange={setZoomLevel}
                        style={{ width: '30%' }}
                      />
                    </Space>
                  </Space>
                </Card>

                <Card style={{ width: '100%' }}>
                  <Spin spinning={isLoading} tip="加载知识图谱中...">
                    <svg
                      ref={svgRef}
                      style={{ width: '100%', height: '600px', border: '1px solid #e8e8e8', borderRadius: '4px' }}
                    />
                  </Spin>
                </Card>

                <Card title="实体类型说明" style={{ width: '100%' }}>
                  <Space direction="vertical" size="small">
                    <Text><span style={{ color: d3.schemeCategory10[0], marginRight: '5px' }}>●</span>概念</Text>
                    <Text><span style={{ color: d3.schemeCategory10[1], marginRight: '5px' }}>●</span>技术</Text>
                    <Text><span style={{ color: d3.schemeCategory10[2], marginRight: '5px' }}>●</span>项目</Text>
                    <Text><span style={{ color: d3.schemeCategory10[3], marginRight: '5px' }}>●</span>人物</Text>
                    <Text><span style={{ color: d3.schemeCategory10[4], marginRight: '5px' }}>●</span>书籍</Text>
                  </Space>
                </Card>
              </Space>
            )
          },
          {
            key: 'schema',
            label: 'Schema 驱动视图',
            children: <SchemaKG />
          },
          {
            key: 'ckb',
            label: 'CKB 浏览器',
            children: <CKBExplorer />
          }
        ]}
      />
    </div>
  )
}

export default KnowledgeGraph