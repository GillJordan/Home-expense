const scriptURL = "/.netlify/functions/addExpense";

// 🔹 Save data locally in LocalStorage
function saveOffline(data) {
  let pending = JSON.parse(localStorage.getItem("pendingEntries")) || [];
  pending.push(data);
  localStorage.setItem("pendingEntries", JSON.stringify(pending));
  alert("📌 Internet nahi hai, data offline save ho gaya. Net aate hi sync ho jaayega.");
}

// 🔹 Try to sync pending data from LocalStorage
async function syncOfflineData() {
  let pending = JSON.parse(localStorage.getItem("pendingEntries")) || [];
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i++) {
    try {
      const res = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending[i])
      });
      const result = await res.json();

      if (result.result === "success") {
        console.log("✅ Synced:", pending[i]);
        pending.splice(i, 1); // remove synced entry
        i--; // adjust index after removal
      }
    } catch (err) {
      console.warn("❌ Sync failed, retry later:", err);
      break; // stop loop if error, try later
    }
  }

  localStorage.setItem("pendingEntries", JSON.stringify(pending));
}

// 🔹 Form submit handler
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.result === "success") {
      alert("✅ Data submitted successfully!");
      this.reset();
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    // Agar net nahi hai ya API fail ho gaya
    saveOffline(data);
  }
});

// 🔹 Net reconnect hone pe auto sync
window.addEventListener("online", syncOfflineData);

// 🔹 Page load pe bhi check kar le
window.addEventListener("load", syncOfflineData);
