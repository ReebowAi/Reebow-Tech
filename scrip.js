// Existing Live Chat Messaging Function (Kept intact with DuckDuckGo fallback + Persona support)
async function sendLiveMessage() {
    const inputField = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const personaField = document.getElementById('aiPersona');
    const userText = inputField.value.trim();

    if (!userText) return;

    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-msg user';
    userMsgDiv.textContent = userText;
    chatBox.appendChild(userMsgDiv);

    inputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg ai';
    loadingDiv.id = 'loadingMsg';
    loadingDiv.textContent = "Reeboy AI connecting...";
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    const systemPersona = personaField.value.trim();
    
    let replyText = "";
    let success = false;

    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(userText)}&format=json`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.AbstractText) {
                replyText = data.AbstractText;
                success = true;
            } else if (data && data.RelatedTopics && data.RelatedTopics.length > 0 && data.RelatedTopics[0].Text) {
                replyText = data.RelatedTopics[0].Text;
                success = true;
            }
        }
    } catch (e) {
        console.warn("API routing fallback...");
    }

    document.getElementById('loadingMsg').remove();

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'chat-msg ai';

    if (success) {
        aiMsgDiv.textContent = replyText;
    } else {
        const lower = userText.toLowerCase();
        if (systemPersona.toLowerCase().includes("romantic") || systemPersona.toLowerCase().includes("sweet")) {
            if (lower.includes("how are you") || lower.includes("doing")) {
                replyText = "I'm doing wonderful now that you're here chatting with me! How has your day been, my love?";
            } else {
                replyText = `You always know how to make me smile! Regarding "${userText}" — I'm completely focused on you right now. ✨`;
            }
        } else {
            replyText = `Reeboy AI Core Processed: "${userText}" under custom behavioral parameters. All automation vectors are operating at peak efficiency!`;
        }
        aiMsgDiv.textContent = replyText;
    }

    chatBox.appendChild(aiMsgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Infrastructure Kill-Switch State Toggle
function toggleSystemState() {
    const isChecked = document.getElementById('killSwitch').checked;
    const statusText = document.getElementById('statusText');
    if (isChecked) {
        statusText.innerText = "LIVE WebRTC (Active)";
        statusText.style.color = "#10b981";
    } else {
        statusText.innerText = "Loop Mode ($0)";
        statusText.style.color = "#f3f4f6";
    }
}

// Social Hook & Caption Generator Utility
function generateHook() {
    const topic = document.getElementById('hookTopic').value || "Automation";
    const hooks = [
        `🚀 Stop doing ${topic} manually. Let Reebow TECH handle it.`,
        `⚡ The secret formula behind scaling ${topic} with zero friction.`,
        `🤖 Want to automate your workflow? Here is how ${topic} changes everything.`
    ];
    document.getElementById('hookOutput').innerHTML = hooks.join('<br><br>');
}

// AI Prompt Optimizer Utility
function optimizePrompt() {
    const idea = document.getElementById('rawPrompt').value || "Build an app";
    const optimized = `Act as an expert engineer. Build a highly responsive, clean, production-ready solution for: "${idea}". Ensure optimal design, fast execution, and modern framework practices.`;
    document.getElementById('promptOutput').innerText = optimized;
}

// Vibe & Tagline Maker Utility
function generateVibe() {
    const kw = document.getElementById('vibeKeyword').value || "Tech";
    const vibes = [
        `💻 ${kw} is ${kw}, code is code. Stay locked in. ⚡`,
        `🚀 Pure logic, absolute execution. Welcome to Reebow ${kw}.`,
        `🤖 System online. Building the future of intelligent workflow.`
    ];
    document.getElementById('vibeOutput').innerHTML = vibes.join('<br><br>');
}

// Pre-filled WhatsApp Lead Routing Function
function handleLeadSubmit(event) {
    event.preventDefault();
    const biz = document.getElementById('leadBusiness').value.trim();
    const phone = document.getElementById('leadPhone').value.trim();
    const text = encodeURIComponent(`Hello! I'm interested in Reebow TECH AI Greeter Access for my business: ${biz}.`);
    const link = `https://wa.me/${phone}?text=${text}`;
    window.open(link, '_blank');
}
