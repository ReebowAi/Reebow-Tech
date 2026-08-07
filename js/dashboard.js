// Control Tower State & Kill-Switch Controller
function toggleSystemState() {
    const isChecked = document.getElementById('killSwitch').checked;
    const statusText = document.getElementById('statusText');
    const towerStatus = document.getElementById('towerStatus');
    const cloudCost = document.getElementById('cloudCost');

    if (isChecked) {
        statusText.innerText = "LIVE WebRTC (Active)";
        statusText.style.color = "#10b981";
        towerStatus.innerText = "High-Performance Stream";
        cloudCost.innerText = "$0.20 / hr (GPU Active)";
    } else {
        statusText.innerText = "Loop Mode ($0)";
        statusText.style.color = "#f3f4f6";
        towerStatus.innerText = "Operational (Kill-Switch Tripped)";
        cloudCost.innerText = "$0.00 / hr";
    }
}
