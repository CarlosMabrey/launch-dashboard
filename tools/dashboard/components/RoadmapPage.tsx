import React, { useState } from 'react';
import { useRoadmapData } from '../hooks/useRoadmapData';
import RoadmapHeader from './RoadmapHeader';
import RoadmapListView from './RoadmapListView';
import RoadmapKanbanView from './RoadmapKanbanView';
import RoadmapProjectMap from './RoadmapProjectMap';
import { RoadmapItem, RoadmapStatus, RoadmapView } from '../types/roadmap';
import { GLASS } from '../App';

const RoadmapPage: React.FC = () => {
    const {
        projects,
        loading,
        error,
        refresh,
        stats,
        filteredItems,
        projectFilter,
        setProjectFilter,
        searchQuery,
        setSearchQuery,
        view,
        setView
    } = useRoadmapData();

    const handleStatusChange = async (item: RoadmapItem, newStatus: RoadmapStatus) => {
        // Optimistic UI update could be done, but for now we'll just log and rely on manual refresh or SSE
        console.log(`Change ${item.title} status from ${item.status} to ${newStatus}`);
        // Future: call API to update underlying task
    };

    const handleItemClick = (item: RoadmapItem) => {
        // Could open a detail modal or VS Code
        console.log('Item clicked:', item);
    };

    const tabs: { id: RoadmapView; label: string; icon: string }[] = [
        { id: 'list', label: 'List', icon: '📋' },
        { id: 'kanban', label: 'Kanban', icon: '📌' },
        { id: 'projectmap', label: 'Project Map', icon: '🗺️' }
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <RoadmapHeader
                projects={projects}
                projectFilter={projectFilter}
                onProjectChange={setProjectFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                stats={stats}
                onRefresh={refresh}
                loading={loading}
            />

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setView(tab.id)}
                        className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${view === tab.id
                            ? 'border-sky-500 text-white'
                            : 'border-transparent text-white/40 hover:text-white/60'
                            }`}
                    >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {loading && filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/40">
                    <div className="text-4xl animate-spin mb-4">⏳</div>
                    <p>Loading roadmap...</p>
                </div>
            ) : (
                <>
                    {view === 'list' && (
                        <RoadmapListView
                            items={filteredItems}
                            onStatusChange={handleStatusChange}
                            onItemClick={handleItemClick}
                        />
                    )}
                    {view === 'kanban' && (
                        <RoadmapKanbanView
                            items={filteredItems}
                            onStatusChange={handleStatusChange}
                        />
                    )}
                    {view === 'projectmap' && (
                        <RoadmapProjectMap
                            items={filteredItems}
                            projects={projects}
                            selectedProject={projectFilter}
                            onProjectChange={setProjectFilter}
                        />
                    )}
                </>
            )}

            {/* Context Menu (simple placeholder) */}
            {/* Would be implemented with a proper context menu component */}
        </div>
    );
};

export default RoadmapPage;
