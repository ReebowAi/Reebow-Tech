/**
 * Reebow TECH Background Management Daemon
 * Automatically checks active client hours, updates subscription balances, 
 * and pauses assistant widgets when hours reach zero.
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

function runBackgroundManager() {
    console.log("🤖 Reebow Background Management Service Initialized...");
    
    // Runs an hourly check loop (simulated every 60 seconds for verification)
    setInterval(() => {
        try {
            if (!fs.existsSync(dbPath)) {
                console.warn("Client database file not found.");
                return;
            }

            const rawData = fs.readFileSync(dbPath, 'utf8');
            const db = JSON.parse(rawData);

            let updated = false;
            db.clients.forEach(client => {
                if (client.status === 'ACTIVE' && client.remainingHours > 0) {
                    client.remainingHours -= 1;
                    console.log(`[SERVICE UPDATE] Client [${client.businessName}] hours updated. Remaining: ${client.remainingHours}`);
                    updated = true;

                    if (client.remainingHours <= 0) {
                        client.status = 'PAUSED';
                        client.streamEndpoint = null;
                        console.log(`[SERVICE PAUSED] Client [${client.businessName}] balance reached 0. Assistant widget paused pending renewal.`);
                    }
                }
            });

            if (updated) {
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
                console.log("[DATABASE SYNC] Client records successfully synchronized.");
            }
        } catch (err) {
            console.error("Error executing background service loop:", err);
        }
    }, 60000);
}

runBackgroundManager();
