const apiURL = "/.netlify/functions/addExpense";

// ✅ Save pending entries offline
function savePendingEntry(data) {
  let pending = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  pending.push(data);
  localStorage.setItem("pendingEntries", JSON.stringify(pending));
  alert("📴 Offline: Entry saved locally, will sync when online!");
}

// ✅ Sync pending entries when online
async function syncPendingEntries() {
  let pending = JSON.parse(localStorage.getItem("pendingEntries") || "[]");
  if (pending.length === 0) return;

  for (let entry of pending) {
    try {
      await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch (err) {
      console.error("❌ Sync failed for:", entry, err);
      return; // stop sync if any fails
    }
  }
  localStorage.removeItem("pendingEntries");
  alert("🌐 Back online: Pending entries synced!");

  // ✅ Reload today’s data after sync
  const today = new Date().toISOString().split("T")[0];
  loadDailyData(today);
  preloadAllEntries();
}

// ✅ Form Submit
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  if (!navigator.onLine) {
    savePendingEntry(data);
    return;
  }

  try {
    const res = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.message) {
      alert("✅ Data submitted successfully!");
      this.reset();
      document.getElementById("dateInput").value = new Date().toISOString().split("T")[0];

      // 🔹 Update cache
      let cache = JSON.parse(localStorage.getItem("entriesCache") || "[]");
      cache.push(result.row);
      localStorage.setItem("entriesCache", JSON.stringify(cache));

      // 🔹 Update today’s data instantly
      let todayCache = JSON.parse(localStorage.getItem("todayData") || "[]");
      todayCache.push(result.row);
      localStorage.setItem("todayData", JSON.stringify(todayCache));
      renderDailyTable(todayCache);
    }
  } catch (err) {
    console.error("❌ Submit error:", err);
  }
});

// ✅ Load Daily Data
async function loadDailyData(date) {
  if (!navigator.onLine) {
    console.warn("📴 Offline: showing cached today data");
    const cached = localStorage.getItem("todayData");
    if (cached) renderDailyTable(JSON.parse(cached));
    else document.getElementById("dailyData").innerHTML = "<p>No data available</p>";
    return;
  }

  try {
    const res = await fetch(`${apiURL}?daily=true&date=${date}`);
    const result = await res.json();
    if (result.data) {
      localStorage.setItem("todayData", JSON.stringify(result.data));
      renderDailyTable(result.data);
    }
  } catch (err) {
    console.error("❌ Daily load error:", err);
  }
}

// ✅ Render Daily Table
function renderDailyTable(rows) {
  let html = "";
  let totalDebit = 0;

  if (rows && rows.length > 0) {
    html = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border">Date</th>
            <th class="p-2 border">Product</th>
            <th class="p-2 border">Debit</th>
            <th class="p-2 border">For</th>
            <th class="p-2 border">Quantity</th>
            <th class="p-2 border">By</th>
            <th class="p-2 border">From</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            let debit = parseFloat(r[4] || 0);
            totalDebit += isNaN(debit) ? 0 : debit;
            return `
              <tr>
                <td class="p-2 border">${r[1] || ""}</td>
                <td class="p-2 border">${r[5] || ""}</td>
                <td class="p-2 border">${r[4] || ""}</td>
                <td class="p-2 border">${r[6] || ""}</td>
                <td class="p-2 border">${r[7] || ""}</td>
                <td class="p-2 border">${r[8] || ""}</td>
                <td class="p-2 border">${r[9] || ""}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="mt-4 font-bold text-green-400">Total Debit Today: ${totalDebit}</p>
    `;
  } else {
    html = "<p class='text-gray-400'>No data for today</p>";
  }

  document.getElementById("dailyData").innerHTML = html;
}

// ✅ Preload full sheet data into cache (for offline search)
async function preloadAllEntries() {
  if (!navigator.onLine) return;
  try {
    const res = await fetch(`${apiURL}?all=true`);
    const result = await res.json();
    if (result.data) {
      localStorage.setItem("entriesCache", JSON.stringify(result.data));
      console.log("✅ Preloaded all entries into cache");
    }
  } catch (err) {
    console.error("❌ Failed to preload entries:", err);
  }
}

// ✅ Search (Online + Offline)
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  // 📴 OFFLINE MODE
  if (!navigator.onLine) {
    console.warn("📴 Offline search running on full cache");
    const cache = JSON.parse(localStorage.getItem("entriesCache") || "[]");

    let filtered = cache.filter(r => (query === "" || (r[5] || "").toLowerCase().includes(query)));

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter(r => {
        try {
          const rowDate = new Date(r[1]);
          return rowDate >= start && rowDate <= end;
        } catch {
          return false;
        }
      });
    }

    renderSearchResults({ data: filtered, totalDebit: calcTotalDebit(filtered) });
    return;
  }

  // 🌐 ONLINE MODE
  let url = `/.netlify/functions/addExpense?search=${encodeURIComponent(query)}`;
  if (startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }

  try {
    const res = await fetch(url);
    const result = await res.json();

    // 🔹 Refresh cache with full dataset
    preloadAllEntries();

    renderSearchResults(result);
  } catch (err) {
    console.error("❌ Search error:", err);
  }
}

// ✅ Render Search Results
function renderSearchResults(result) {
  let html = "";
  if (result.data && result.data.length > 0) {
    html = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border">Date</th>
            <th class="p-2 border">Product</th>
            <th class="p-2 border">Debit</th>
            <th class="p-2 border">For</th>
            <th class="p-2 border">Quantity</th>
            <th class="p-2 border">By</th>
            <th class="p-2 border">From</th>
          </tr>
        </thead>
        <tbody>
          ${result.data.map(r => `
            <tr>
              <td class="p-2 border">${r[1] || ""}</td>
              <td class="p-2 border">${r[5] || ""}</td>
              <td class="p-2 border">${r[4] || ""}</td>
              <td class="p-2 border">${r[6] || ""}</td>
              <td class="p-2 border">${r[7] || ""}</td>
              <td class="p-2 border">${r[8] || ""}</td>
              <td class="p-2 border">${r[9] || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="mt-4 font-bold text-green-400">Total Debit: ${result.totalDebit}</p>
    `;
  } else {
    html = "<p class='text-red-400 mt-4'>No records found</p>";
  }

  document.getElementById("searchResults").innerHTML = html;
}

// ✅ Helper for debit sum
function calcTotalDebit(rows) {
  return rows.reduce((sum, r) => sum + (parseFloat(r[4] || 0) || 0), 0);
}

// ✅ Sync when back online
window.addEventListener("online", () => {
  syncPendingEntries();
  preloadAllEntries();
});

// ✅ Preload full cache at startup if online
window.addEventListener("load", preloadAllEntries);
