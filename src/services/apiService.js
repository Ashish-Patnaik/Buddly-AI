// src/services/apiService.js

const API_BASE_URL = import.meta.env.VITE_PUBLIC_SERVER_URL;

async function sendRequest(endpoint, body) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'API request failed');
        }
        return response.json();
    } catch (error) {
        console.error(`Error in ${endpoint}:`, error);
        throw error;
    }
}

export const generateCode = (prompt) => {
    return sendRequest('generate', { prompt });
};

export const followUp = (prompt, code) => {
    return sendRequest('followup', { prompt, code });
};

export const retryWithJson = (originalPrompt, badJson) => {
    return sendRequest('retry', { originalPrompt, badJson });
};
