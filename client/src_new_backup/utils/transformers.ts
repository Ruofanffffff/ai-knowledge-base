import {
  BackendEntity,
  BackendRelation,
  BackendGraphData,
  GraphNode,
  GraphLink,
  FrontendGraphData,
} from '../api/types';

/**
 * Transform backend entity to frontend node
 * Converts the backend entity format (with canonical_name) to the frontend node format (with label)
 * 
 * @param entity - Backend entity object
 * @returns Frontend graph node object
 */
export function transformEntityToNode(entity: BackendEntity): GraphNode {
  return {
    id: entity.id,
    label: entity.canonical_name,
    type: entity.type,
    confidence: entity.confidence,
    schemas: entity.schemas,
    attributes: entity.attributes,
  };
}

/**
 * Transform backend relation to frontend link
 * Converts the backend relation format (with source_id/target_id) to the frontend link format (with source/target)
 * 
 * @param relation - Backend relation object
 * @returns Frontend graph link object
 */
export function transformRelationToLink(relation: BackendRelation): GraphLink {
  return {
    id: relation.id,
    source: relation.source_id,
    target: relation.target_id,
    relation: relation.type,
    subtype: relation.subtype,
    weight: relation.weight,
    confidence: relation.confidence,
  };
}

/**
 * Transform backend graph data to frontend format
 * Converts the complete graph data structure from backend format to frontend format
 * 
 * @param backendData - Backend graph data with entities and relations
 * @returns Frontend graph data with nodes and links
 */
export function transformGraphData(backendData: BackendGraphData): FrontendGraphData {
  return {
    nodes: backendData.entities.map(transformEntityToNode),
    links: backendData.relations.map(transformRelationToLink),
  };
}

/**
 * Transform frontend node to backend entity (for updates)
 * Converts the frontend node format back to backend entity format
 * Returns a partial entity object suitable for update operations
 * 
 * @param node - Frontend graph node object
 * @returns Partial backend entity object
 */
export function transformNodeToEntity(node: GraphNode): Partial<BackendEntity> {
  return {
    id: node.id,
    canonical_name: node.label,
    type: node.type,
    confidence: node.confidence,
    schemas: node.schemas,
    attributes: node.attributes,
  };
}

/**
 * Transform frontend link to backend relation (for updates)
 * Converts the frontend link format back to backend relation format
 * Returns a partial relation object suitable for update operations
 * 
 * @param link - Frontend graph link object
 * @returns Partial backend relation object
 */
export function transformLinkToRelation(link: GraphLink): Partial<BackendRelation> {
  return {
    id: link.id,
    source_id: link.source,
    target_id: link.target,
    type: link.relation,
    subtype: link.subtype,
    weight: link.weight,
    confidence: link.confidence,
  };
}
