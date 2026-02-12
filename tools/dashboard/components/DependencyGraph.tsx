import React, { useEffect, useRef, useState } from 'react';
import { RoadmapItem } from '../types/roadmap';
import { GLASS } from '../App';

interface DependencyGraphProps {
    items: RoadmapItem[];
}

interface GraphNode {
    item: RoadmapItem;
    x: number;
    y: number;
    width: number;
    height: number;
    level: number;
    viewBoxWidth?: number;
    viewBoxHeight?: number;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const LEVEL_SPACING = 100;
const NODE_SPACING = 20;

const DependencyGraph: React.FC<DependencyGraphProps> = ({ items }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            // Build adjacency and compute levels
            const itemMap = new Map<string, RoadmapItem>();
            items.forEach(item => itemMap.set(item.id, item));

            // Compute level (longest path from any root)
            const memo = new Map<string, number>();
            const computeLevel = (id: string): number => {
                if (memo.has(id)) return memo.get(id)!;
                const item = itemMap.get(id);
                if (!item) return 0;
                if (!item.dependencies || item.dependencies.length === 0) {
                    memo.set(id, 0);
                    return 0;
                }
                let maxDepLevel = 0;
                for (const depId of item.dependencies) {
                    const depLevel = computeLevel(depId);
                    if (depLevel > maxDepLevel) maxDepLevel = depLevel;
                }
                const level = maxDepLevel + 1;
                memo.set(id, level);
                return level;
            };

            // Assign levels to all nodes
            const levelMap = new Map<string, number>();
            items.forEach(item => {
                levelMap.set(item.id, computeLevel(item.id));
            });

            // Group by level
            const levelGroups = new Map<number, RoadmapItem[]>();
            items.forEach(item => {
                const lvl = levelMap.get(item.id) || 0;
                if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
                levelGroups.get(lvl)!.push(item);
            });

            // Sort levels and sort items within level (by priority descending, then title)
            const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
            levels.forEach(lvl => {
                levelGroups.get(lvl)!.sort((a, b) => {
                    if (b.priority !== a.priority) return b.priority - a.priority;
                    return a.title.localeCompare(b.title);
                });
            });

            // Compute positions
            const newNodes: GraphNode[] = [];
            levels.forEach(lvl => {
                const group = levelGroups.get(lvl)!;
                const totalWidth = group.length * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
                let startX = -totalWidth / 2; // center horizontally
                group.forEach(item => {
                    const node: GraphNode = {
                        item,
                        x: startX + NODE_WIDTH / 2,
                        y: lvl * (NODE_HEIGHT + LEVEL_SPACING) + NODE_HEIGHT / 2,
                        width: NODE_WIDTH,
                        height: NODE_HEIGHT,
                        level: lvl
                    };
                    newNodes.push(node);
                    startX += NODE_WIDTH + NODE_SPACING;
                });
            });

            // Center graph in viewBox
            if (newNodes.length > 0) {
                const minX = Math.min(...newNodes.map(n => n.x - n.width/2));
                const maxX = Math.max(...newNodes.map(n => n.x + n.width/2));
                const minY = Math.min(...newNodes.map(n => n.y - n.height/2));
                const maxY = Math.max(...newNodes.map(n => n.y + n.height/2));
                const padding = 50;
                const graphWidth = maxX - minX + padding * 2;
                const graphHeight = maxY - minY + padding * 2;
                // Translate to have (0,0) at top-left of viewBox content
                const offsetX = -minX + padding;
                const offsetY = -minY + padding;
                newNodes.forEach(node => {
                    node.x += offsetX;
                    node.y += offsetY;
                });
                // We'll set viewBox accordingly when rendering
                newNodes.forEach(node => {
                    node.viewBoxWidth = graphWidth;
                    node.viewBoxHeight = graphHeight;
                });
            }

            setNodes(newNodes);
            setError(null);
        } catch (err) {
            console.error('Error building graph:', err);
            setError('Failed to build dependency graph');
        }
    }, [items]);

    const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.item.id, n]));

    // Build edges
    const edges: Array<{ from: GraphNode; to: GraphNode; fromItem: RoadmapItem; toItem: RoadmapItem }> = [];
    nodes.forEach(node => {
        if (node.item.dependencies) {
            node.item.dependencies.forEach(depId => {
                const targetNode = nodeMap.get(depId);
                if (targetNode) {
                    edges.push({ from: node, to: targetNode, fromItem: node.item, toItem: targetNode.item });
                } else {
                    // Dependency not in current set; could create invisible node or ignore
                }
            });
        }
    });

    const priorityColors: Record<number, string> = {
        1: '#f43f5e', // rose-500
        2: '#f59e0b', // amber-500
        3: '#0ea5e9', // sky-500
        4: '#6b7280'  // gray-500
    };

    const statusColors: Record<string, string> = {
        todo: '#6b7280',
        'in-progress': '#0ea5e9',
        blocked: '#f43f5e',
        done: '#22c55e'
    };

    if (error) {
        return <div className="text-rose-400 p-8 text-center">{error}</div>;
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-white/40">
                <div className="text-6xl mb-4">🗺️</div>
                <p className="text-lg">No items to map</p>
                <p className="text-sm">Select a project with tasks to view dependencies</p>
            </div>
        );
    }

    // Set viewBox to cover all nodes
    let viewBox = '0 0 800 600';
    if (nodes.length > 0) {
        const maxWidth = Math.max(...nodes.map(n => n.viewBoxWidth || 800));
        const maxHeight = Math.max(...nodes.map(n => n.viewBoxHeight || 600));
        viewBox = `0 0 ${maxWidth} ${maxHeight}`;
    }

    return (
        <div className={`${GLASS} rounded-2xl overflow-hidden`}>
            <svg
                ref={svgRef}
                viewBox={viewBox}
                className="w-full h-[600px] bg-slate-900/50"
                style={{ minHeight: '600px' }}
            >
                {/* Edges */}
                <g className="edges">
                    {edges.map((edge, idx) => {
                        const startX = edge.from.x;
                        const startY = edge.from.y - edge.from.height/2;
                        const endX = edge.to.x;
                        const endY = edge.to.y + edge.to.height/2;
                        // Bezier curve: vertical drop then horizontal line to target
                        const midY = (startY + endY) / 2;
                        const pathData = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
                        return (
                            <path
                                key={`edge-${idx}`}
                                d={pathData}
                                fill="none"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead)"
                            />
                        );
                    })}
                </g>

                {/* Arrowhead marker definition */}
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.3)" />
                    </marker>
                </defs>

                {/* Nodes */}
                <g className="nodes">
                    {nodes.map(node => (
                        <g
                            key={node.item.id}
                            transform={`translate(${node.x - node.width/2}, ${node.y - node.height/2})`}
                            className="cursor-pointer hover:scale-105 transition-transform"
                        >
                            <rect
                                width={node.width}
                                height={node.height}
                                rx={12}
                                className={`fill-white/5 stroke-2 stroke-${statusColors[node.item.status] || 'gray'}/30 backdrop-blur-sm`}
                                style={{ stroke: statusColors[node.item.status] || '#6b7280' }}
                            />
                            <foreignObject width={node.width - 8} height={node.height - 8} x={4} y={4}>
                                <div className="p-3 h-full flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider text-${priorityColors[node.item.priority].replace('#', '')}`}
                                              style={{ color: priorityColors[node.item.priority] }}>
                                            P{node.item.priority}
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase`}
                                              style={{ backgroundColor: statusColors[node.item.status] + '20', color: statusColors[node.item.status] }}>
                                            {node.item.status}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">
                                        {node.item.title}
                                    </h4>
                                    {node.item.assignee && (
                                        <div className="mt-auto text-[10px] text-white/50 flex items-center gap-1">
                                            👤 {node.item.assignee}
                                        </div>
                                    )}
                                    {node.item.estimateHours && (
                                        <div className="text-[10px] text-white/40 flex items-center gap-1">
                                            ⏱️ {Math.round(node.item.estimateHours)}h
                                        </div>
                                    )}
                                </div>
                            </foreignObject>
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default DependencyGraph;
