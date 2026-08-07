/**
 * Reebow TECH - Front Door Utility Controller
 * Powers social post generation, assistant instruction builders, and slogan makers.
 */

function generateHook() {
    const topic = document.getElementById('hookTopic').value.trim() || "Business Growth";
    const hooks = [
        `🚀 Looking for a better way to handle ${topic}? Here is how Reebow TECH helps your business run smoothly every single day.`,
        `⚡ Discover how top local businesses are streamlining ${topic} without adding extra workload to their staff.`,
        `🤖 Want to give your customers instant answers on your website? Here is how ${topic} transforms your client communication.`
    ];
    document.getElementById('hookOutput').innerHTML = hooks.join('<br><br>');
}

function optimizePrompt() {
    const raw = document.getElementById('rawPrompt').value.trim() || "assist customers politely";
    const optimized = `[ASSISTANT GUIDELINE: PROFESSIONAL SERVICE] Ensure polite, clear, and helpful communication for the following core instruction: "${raw}". Keep answers concise, welcoming, and directly focused on assisting the customer.`;
    document.getElementById('promptOutput').innerText = optimized;
}

function generateVibe() {
    const kw = document.getElementById('vibeKeyword').value.trim() || "Service";
    const vibes = [
        `💻 Seamless technology, dependable support. Welcome to Reebow ${kw}. ⚡`,
        `🚀 Bringing simple, powerful digital solutions directly to your business.`,
        `🤖 Always online. Building smarter tools for modern customer care.`
    ];
    document.getElementById('vibeOutput').innerHTML = vibes.join('<br><br>');
}
