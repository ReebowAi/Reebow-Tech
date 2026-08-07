/**
 * Reebow TECH - Client Management Portal Controller
 * Manages assistant toggle states and service meters smoothly.
 */

function toggleSystemState() {
    const isChecked = document.getElementById('killSwitch').checked;
    const statusText = document.getElementById('statusText');
    const towerStatus = document.getElementById('towerStatus');
    const cloudCost = document.getElementById('cloudCost');

    if (isChecked) {
        statusText.innerText = "Live Video Stream Active";
        statusText.style.color = "#10b981";
        towerStatus.innerText = "Assistant is Live on Website";
    } else {
        statusText.innerText = "Standard Mode (Active & Free)";
        statusText.style.color = "#f3f4f6";
        towerStatus.innerText = "Online & Ready";
    }
}
