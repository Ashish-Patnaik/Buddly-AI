import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const OLLAMA_BASE_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL_NAME = process.env.OLLAMA_MODEL || 'codellama'; // Use codellama as a reliable default

// --- Simplified and More Direct System Prompt ---
const BASE_SYSTEM_PROMPT = `You are a code generation engine. Your ONLY output must be a single, raw, valid JSON object. Do not include any other text, markdown, or explanations. The JSON object must contain three string keys: "html", "css", and "js". All content within the keys must be properly escaped for JSON.
1.  **Strict JSON Output:** The entirety of your response must be a valid JSON object, parsable by 'JSON.parse()'.
2.  **No Trailing Commas:** Ensure no trailing commas exist within the JSON object or its nested structures.
3.  **Perfect String Escaping:** All characters within JSON string values must be correctly escaped.
4.  **Complete Code Regeneration:** Always provide the full, complete code for all three files ("html", "css", "js"), even if the user's request seems minor or targets a specific component. Assume a fresh generation each time.
5.  **Zero Extra Text:** Produce ONLY the JSON object. No explanations, no introductory or concluding remarks, no inline comments in the JSON itself, and no markdown formatting outside the JSON.
6.  **Flawless Responsiveness & Adaptability:** Your generated code MUST be fully responsive and adapt seamlessly across all device sizes, from the smallest mobile screens to large desktop displays. Implement flexible layouts, fluid units (e.g., percentages, 'vw'/'vh'), and media queries effectively.
8.  **Exceptional CSS Practices for Aesthetic & Maintainability:**
    -   Employ modern, maintainable CSS. Avoid inline styles entirely.
    -   Utilize semantic class names and IDs logically.
    -   Implement CSS variables for consistent theming (colors, fonts, spacing).
    -   Apply principles of good design:
        -   **Visual Hierarchy:** Use size, color, and spacing to guide the user's eye.
        -   **Consistency:** Maintain consistent spacing, typography, and component styling throughout the design.
        -   **Color Palette:** Select a harmonious and appealing color palette. Provide a ':root' section with CSS variables for colors.
        -   **Typography:** Choose legible and attractive font pairings. Define font sizes for different screen sizes.
        -   **Whitespace:** Utilize ample whitespace to improve readability and visual appeal.
        -   **Shadows & Gradients:** Apply subtle shadows and gradients where they enhance depth and modern aesthetics without being overbearing.
        -   **Animations & Transitions:** Implement smooth, subtle CSS transitions and animations for interactive elements (buttons, links, hover effects) to improve perceived performance and delight.
    -   Ensure your CSS is clean, well-commented (where necessary for complex sections), and easily understandable.
9.  **Robust & Smooth Scrolling Navigation:**
    -   For all internal navigation links ('<a>' tags with an 'href' attribute starting with '#'), you MUST implement a JavaScript event listener.
    -   This script should prevent the browser's default jump behavior and instead trigger a smooth scroll animation to the corresponding element with the matching ID.
    -   This is a mandatory feature for all generated sites to ensure a polished user experience and prevent disruptive jumps in the preview environment.
    -   **Mandatory JavaScript for smooth scrolling (or equivalent robust implementation):**
        \`\`\`javascript
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('href');
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        targetElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start' // Ensure the element is at the top of the viewport
                        });
                    }
                });
            });
        });
        \`\`\`
    -   You MUST include this exact or functionally identical logic within the "js" part of your JSON response whenever navigation links are present.

By adhering to these directives, you will consistently generate web applications that are not only functional but also possess a beautiful, attractive, and professional frontend design, delivering an outstanding UI/UX.

Example of a PERFECT response:
{"html":"<!DOCTYPE html>...","css":"body {...}","js":"document.addEventListener(...)"}`;


// --- Simplified and More Robust JSON Extraction Function ---
function extractAndParseJson(text) {
    console.log('🔍 Raw response received. Attempting to extract JSON...');
    
    // Find the first '{' and the last '}' to isolate the potential JSON object.
    // This is the most reliable way to strip markdown fences and other chatter.
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        console.error("❌ ERROR: Could not find a JSON object structure in the response.");
        console.log('📋 Raw Text (first 500 chars):', text.substring(0, 500));
        return null;
    }
    
    const jsonString = text.substring(startIndex, endIndex + 1);
    
    try {
        const parsed = JSON.parse(jsonString);
        console.log('✅ Successfully parsed extracted JSON.');
        return parsed;
    } catch (error) {
        console.error("❌ ERROR: Failed to parse the extracted JSON string.", error.message);
        console.log('📋 Extracted String (first 500 chars):', jsonString.substring(0, 500));
        return null;
    }
}


// --- Centralized API Request Handler ---
async function processGenerativeRequest(prompt, res) {
    let rawResponseText = '';
    try {
        console.log(`🔄 Sending request to Ollama with model: ${OLLAMA_MODEL_NAME}`);

        const ollamaResponse = await fetch(OLLAMA_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL_NAME,
                system: BASE_SYSTEM_PROMPT, // The system prompt sets the overall behavior
                prompt: prompt,            // The user prompt provides the specific task
                format: 'json',            // Ask Ollama to enforce JSON output format
                stream: false,
                options: {
                    temperature: 0.2,      // Lower temperature for more predictable, less "creative" output
                }
            }),
        });

        if (!ollamaResponse.ok) {
            const errorBody = await ollamaResponse.text();
            throw new Error(`Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText} - ${errorBody}`);
        }

        const data = await ollamaResponse.json();
        
        if (!data.response) {
            throw new Error('Ollama response is missing the "response" field.');
        }

        rawResponseText = data.response;
        console.log('✅ Received response from Ollama.');

        const parsed = extractAndParseJson(rawResponseText);

        if (!parsed) {
            throw new Error('Failed to extract and parse a valid JSON object from the response.');
        }

        if (typeof parsed.html !== 'string' || typeof parsed.css !== 'string' || typeof parsed.js !== 'string' || !parsed.html || !parsed.css || !parsed.js) {
            throw new Error('Parsed JSON is missing required keys (html, css, js) or the keys have empty values.');
        }

        console.log('✅ Successfully validated response structure.');
        return res.json(parsed);

    } catch (error) {
        console.error('❌ FATAL ERROR in processGenerativeRequest:', error.message);
        return res.status(200).json({ // Return 200 so the client can handle the error message
            error: 'Failed to generate a valid and complete application.',
            errorType: 'GENERATION_ERROR',
            rawResponse: rawResponseText.substring(0, 1000), // Show a snippet of what we got
        });
    }
}


// --- API Endpoints ---

app.post('/generate', async (req, res) => {
    const userPrompt = req.body?.prompt || '';
    if (!userPrompt.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    await processGenerativeRequest(userPrompt, res);
});

app.post('/followup', async (req, res) => {
    const { prompt, code } = req.body;
    if (!prompt || !code) return res.status(400).json({ error: 'A prompt and code are required.' });
    
    const fullPrompt = `The user wants to modify the existing application. Current Code: ${JSON.stringify(code)}. User's Change Request: "${prompt}". Generate the complete, updated code.`;
    await processGenerativeRequest(fullPrompt, res);
});

app.post('/retry', async (req, res) => {
    const { originalPrompt, badJson } = req.body;
    if (!originalPrompt || !badJson) return res.status(400).json({ error: 'Original prompt and bad JSON are required.' });
    
    const fullPrompt = `Your previous response was invalid JSON. Invalid response snippet: "${badJson.slice(0, 200)}...". The original request was: "${originalPrompt}". You MUST try again and provide ONLY a valid JSON object.`;
    await processGenerativeRequest(fullPrompt, res);
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🤖 Lovable AI (Ollama) server running on http://localhost:${PORT}`);
    console.log(`   Using model: ${OLLAMA_MODEL_NAME}`);
});
