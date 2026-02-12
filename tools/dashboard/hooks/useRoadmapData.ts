import { useEffect, useState, useCallback, useRef } from 'react';
import { RoadmapItem, ProjectInfo, RoadmapStats, RoadmapView } from '../types/roadmap';
import { loadAllItems, getProjects, connectToUpdates } from '../services/roadmapService';

interface UseRoadmapDataResult {
    items: RoadmapItem[];
    projects: ProjectInfo[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    stats: RoadmapStats;
    filteredItems: RoadmapItem[];
    setProjectFilter: (project: string) => void;
    setSearchQuery: (query: string) => void;
    setView: (view: RoadmapView) => void;
    view: RoadmapView;
    projectFilter: string;
    searchQuery: string;
}

export function useRoadmapData(): UseRoadmapDataResult {
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [projects, setProjects] = useState<ProjectInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<RoadmapView>('list');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [itemsData, projectsData] = await Promise.all([
                loadAllItems(),
                getProjects()
            ]);
            setItems(itemsData);
            setProjects(projectsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load roadmap data');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh via SSE or polling
    useEffect(() => {
        // Try SSE first
        const disconnect = connectToUpdates(() => {
            // When we receive an update event, refresh data
            fetchData();
        });

        // Fallback to polling every 30 seconds
        const pollInterval = setInterval(() => {
            fetchData();
        }, 30000);

        return () => {
            disconnect();
            clearInterval(pollInterval);
        };
    }, [fetchData]);

    // Filtered items based on project and search
    const filteredItems = items.filter(item => {
        const matchesProject = !projectFilter || projectFilter === 'all' || item.project === projectFilter;
        const matchesSearch = !searchQuery.trim() ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesProject && matchesSearch;
    });

    // Stats for filtered items
    const stats: RoadmapStats = {
        total: filteredItems.length,
        byStatus: filteredItems.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
        urgentCount: filteredItems.filter(item => item.priority === 1 && item.status !== 'done').length
    };

    return {
        items,
        projects,
        loading,
        error,
        refresh: fetchData,
        stats,
        filteredItems,
        setProjectFilter,
        setSearchQuery,
        setView,
        view,
        projectFilter,
        searchQuery
    };
}
