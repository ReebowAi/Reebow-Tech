/**
 * Reebow TECH Automation Worker
 * Runs as a background clock daemon simulating automated hourly checks.
 * Depletes active client balances and trips the kill-switch automatically when hours hit 0.
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

function runAutomationDaemon() {
    console.log("🤖 Reebow Automation Worker Clock Initialized...");
    
    setInterval(() => {
        try {
            const rawData = fs.readFileSync(dbPath, 'utf8');
            const db = JSON.parse(rawData);

            let updated = false;
            db.clients.forEach(client => {
                if (client.status === 'ACTIVE' && client.remainingHours > 0) {
                    client.remainingHours -= 1;
                    console.log(`[CLOCK TICK] Client ${client.businessName} hours decremented. Remaining: ${client.remainingHours}`);
                    updated = true;

                    if (client.remainingHours <= 0) {
                        client.status = 'SUSPENDED';
                        client.gpuStreamEndpoint = null;
                        console.log(`[KILL-SWITCH TRIGGERED] Client ${client.businessName} balance depleted. GPU container terminated.`);
                    }
                }
            });

            if (updated) {
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            }
        } catch (err) {
            console.error("Error executing automation worker loop:", err);
        }
    }, 60000); // Runs every 60 seconds for simulation testing
}

runAutomationDaemon();
