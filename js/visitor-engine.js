/**
 * Reebow TECH - Live Visitor Chat Engine
 * Provides smooth, reliable fallback answers for website visitors and clients.
 */

async function sendVisitorMessage() {
    const inputField = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const personaField = document.getElementById('aiPersona');
    const userText = inputField.value.trim();

    if (!userText) return;

    // Append user message to chat UI
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-msg user';
    userMsgDiv.textContent = userText;
    chatBox.appendChild(userMsgDiv);

    inputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // Append loading status
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg ai';
    loadingDiv.id = 'loadingMsg';
    loadingDiv.textContent = "Assistant is typing a response...";
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    const systemPersona = personaField.value.trim();
    let replyText = "";
    let success = false;

    // Query active answer endpoints with fallback safety
    const endpoints = [
        `https://api.duckduckgo.com/?q=${encodeURIComponent(userText)}&format=json`,
        `https://api.duckduckgo.com/?q=${encodeURIComponent(systemPersona + " " + userText)}&format=json`
    ];

    for (let endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                if (data && data.AbstractText && data.AbstractText.length > 5) {
                    replyText = data.AbstractText;
                    success = true;
                    break;
                } else if (data && data.RelatedTopics && data.RelatedTopics.length > 0) {
                    for (let topic of data.RelatedTopics) {
                        if (topic.Text && topic.Text.length > 5) {
                            replyText = topic.Text;
                            success = true;
                            break;
                        }
                    }
                    if (success) break;
                }
            }
        } catch (err) {
            console.warn("Retrying alternate assistant response route...");
        }
    }

    document.getElementById('loadingMsg').remove();

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'chat-msg ai';

    if (success) {
        aiMsgDiv.textContent = replyText;
    } else {
        const lower = userText.toLowerCase();
        if (systemPersona.toLowerCase().includes("hospital") || systemPersona.toLowerCase().includes("receptionist")) {
            if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
                replyText = "Hello and welcome to our reception! How may I direct your inquiry or help schedule your visit today?";
            } else {
                replyText = `Thank you for your question about "${userText}". Our reception team is happy to assist you with this right away.`;
            }
        } else {
            replyText = `Thanks for reaching out! We received your message: "${userText}". How else can our team help you today?`;
        }
        aiMsgDiv.textContent = replyText;
    }

    chatBox.appendChild(aiMsgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}
