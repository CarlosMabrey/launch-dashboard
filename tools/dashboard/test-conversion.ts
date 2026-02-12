import { convertGraphToApi, parameterizeWorkflow } from './utils/comfyConverter';
import fs from 'fs';

const luminaGraph = {
    "nodes": [
        {
            "id": 3,
            "type": "CLIPTextEncode",
            "widgets_values": ["{{PROMPT}}"]
        },
        {
            "id": 10,
            "type": "SaveImage",
            "widgets_values": ["LuminaTurbo"]
        }
    ],
    "links": []
};

console.log("Original Graph:", JSON.stringify(luminaGraph, null, 2));

const apiFormat = convertGraphToApi(luminaGraph);
console.log("\nConverted API Format:", JSON.stringify(apiFormat, null, 2));

const parameterized = parameterizeWorkflow(apiFormat);
console.log("\nParameterized API Format:", JSON.stringify(parameterized, null, 2));
