import React, { useState, useEffect } from 'react';

export interface LoraConfig {
    name: string;
    strength_model: number;
    strength_clip: number;
}

interface GenAILoraSelectorProps {
    availableLoras: string[];
    activeLoras: LoraConfig[];
    onChange: (loras: LoraConfig[]) => void;
}

export function GenAILoraSelector({ availableLoras, activeLoras, onChange }: GenAILoraSelectorProps) {
    const [selectedLora, setSelectedLora] = useState<string>('');

    const handleAdd = () => {
        if (!selectedLora) return;
        if (activeLoras.find(l => l.name === selectedLora)) return;

        const newLora: LoraConfig = {
            name: selectedLora,
            strength_model: 1.0,
            strength_clip: 1.0
        };
        onChange([...activeLoras, newLora]);
        setSelectedLora('');
    };

    const handleRemove = (index: number) => {
        const newLoras = [...activeLoras];
        newLoras.splice(index, 1);
        onChange(newLoras);
    };

    const handleUpdate = (index: number, field: keyof LoraConfig, value: number) => {
        const newLoras = [...activeLoras];
        newLoras[index] = { ...newLoras[index], [field]: value };
        onChange(newLoras);
    };

    return (
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>🧩</span> LoRA Adaptations
            </h4>

            {/* List */}
            <div className="space-y-3 mb-4">
                {activeLoras.length === 0 && (
                    <p className="text-xs text-white/20 italic text-center py-2">No LoRAs active</p>
                )}
                {activeLoras.map((lora, idx) => (
                    <div key={idx} className="bg-black/20 rounded-lg p-3 border border-white/5 relative group">
                        <button
                            onClick={() => handleRemove(idx)}
                            className="absolute top-2 right-2 text-white/20 hover:text-rose-400 transition-colors"
                        >
                            ✕
                        </button>
                        <div className="font-medium text-sm text-indigo-200 mb-2 pr-6 truncate" title={lora.name}>
                            {lora.name}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] text-white/40 uppercase mb-1">Model Strength</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range" min="-1" max="2" step="0.1"
                                        value={lora.strength_model}
                                        onChange={(e) => handleUpdate(idx, 'strength_model', parseFloat(e.target.value))}
                                        className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400"
                                    />
                                    <span className="text-[10px] text-white/60 w-8 text-right">{lora.strength_model.toFixed(1)}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] text-white/40 uppercase mb-1">CLIP Strength</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range" min="-1" max="2" step="0.1"
                                        value={lora.strength_clip}
                                        onChange={(e) => handleUpdate(idx, 'strength_clip', parseFloat(e.target.value))}
                                        className="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                                    />
                                    <span className="text-[10px] text-white/60 w-8 text-right">{lora.strength_clip.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add New */}
            <div className="flex gap-2">
                <select
                    value={selectedLora}
                    onChange={(e) => setSelectedLora(e.target.value)}
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-indigo-500/50 outline-none"
                >
                    <option value="">Select LoRA to add...</option>
                    {availableLoras.map(l => (
                        <option key={l} value={l} className="bg-slate-900">{l}</option>
                    ))}
                </select>
                <button
                    onClick={handleAdd}
                    disabled={!selectedLora}
                    className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-500 hover:text-white disabled:opacity-50 disabled:hover:bg-white/10 transition-colors"
                >
                    Add
                </button>
            </div>
        </div>
    );
}
