import { BackendEntity, BackendRelation, BackendGraphData, FrontendGraphData, GraphNode, GraphLink } from '../api/types';

export function transformGraphData(backendData: BackendGraphData): FrontendGraphData {
  const nodes: GraphNode[] = backendData.entities.map((entity) => ({
    id: entity.id,
    label: entity.canonical_name,
    type: entity.type,
    confidence: entity.confidence,
    schemas: entity.schemas,
    attributes: entity.attributes,
  }));

  const links: GraphLink[] = backendData.relations.map((relation) => ({
    id: relation.id,
    source: relation.source_id,
    target: relation.target_id,
    relation: relation.type,
    subtype: relation.subtype,
    weight: relation.weight,
    confidence: relation.confidence,
  }));

  return { nodes, links };
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
}

export function getAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return '';
  
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  
  const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || '/api';
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${avatar}`;
}
