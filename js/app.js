// Utility Function: Social Hook Generator
function generateHook() {
    const topic = document.getElementById('hookTopic').value || "Automation";
    const hooks = [
        `🚀 Stop doing ${topic} manually. Let Reebow TECH handle it.`,
        `⚡ The secret formula behind scaling ${topic} with zero friction.`,
        `🤖 Want to automate your workflow? Here is how ${topic} changes everything.`
    ];
    document.getElementById('hookOutput').innerHTML = hooks.join('<br><br>');
}

// Utility Function: Prompt Optimizer
function optimizePrompt() {
    const idea = document.getElementById('rawPrompt').value || "Build an app";
    const optimized = `Act as an expert engineer. Build a highly responsive, clean, production-ready solution for: "${idea}". Ensure optimal design, fast execution, and modern framework practices.`;
    document.getElementById('promptOutput').innerText = optimized;
}

// Utility Function: Vibe & Tagline Maker
function generateVibe() {
    const kw = document.getElementById('vibeKeyword').value || "Tech";
    const vibes = [
        `💻 ${kw} is ${kw}, code is code. Stay locked in. ⚡`,
        `🚀 Pure logic, absolute execution. Welcome to Reebow ${kw}.`,
        `🤖 System online. Building the future of intelligent workflow.`
    ];
    document.getElementById('vibeOutput').innerHTML = vibes.join('<br><br>');
}
