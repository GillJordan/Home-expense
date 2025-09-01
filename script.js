const scriptURL = "/.netlify/functions/addExpense";

// 🔹 Save data offline if net not available
function saveOffline(data) {
  let pending = JSON.parse(localStorage.getItem("pendingEntries")) || [];
  pending.push(data);
  localStorage.setItem("pendingEntries", JSON.stringify(pending));
  alert("📌 Internet nahi hai, data offline save ho gaya. Net aate hi sync ho jaayega.");
}

// 🔹 Save full entry for offline search
function saveEntryLocal(data) {
  let all = JSON.parse(localStorage.getItem("allEntries")) || [];
  all.push(data);
  localStorage.setItem("allEntries", JSON.stringify(all));
}

// 🔹 Sync pending data when online
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
        saveEntryLocal(pending[i]); // also save in allEntries
        pending.splice(i, 1);
        i--;
      }
    } catch (err) {
      console.warn("❌ Sync failed, retry later:", err);
      break;
    }
  }

  localStorage.setItem("pendingEntries", JSON.stringify(pending));
}

// 🔹 Save autocomplete suggestions
function saveSuggestion(field, value) {
  if (!value) return;
  let key = field + "Suggestions";
  let suggestions = JSON.parse(localStorage.getItem(key)) || [];
  if (!suggestions.includes(value)) {
    suggestions.push(value);
    localStorage.setItem(key, JSON.stringify(suggestions));
  }
}

// 🔹 Load autocomplete suggestions
function loadSuggestions(field, datalistId) {
  let key = field + "Suggestions";
  let suggestions = JSON.parse(localStorage.getItem(key)) || [];
  let datalist = document.getElementById(datalistId);
  datalist.innerHTML = "";
  suggestions.forEach(item => {
    let option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
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

      // save new suggestions
      saveSuggestion("product", data.product);
      saveSuggestion("for", data.for);
      saveSuggestion("by", data.by);
      saveSuggestion("from", data.from);

      // reload suggestions
      loadSuggestions("product", "productList");
      loadSuggestions("for", "forList");
      loadSuggestions("by", "byList");
      loadSuggestions("from", "fromList");

      // save entry locally for offline search
      saveEntryLocal(data);
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    saveOffline(data);
  }
});

// 🔹 Show search results
function showResults(data) {
  let html = "";
  if (data && data.length > 0) {
    html = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border border-gray-700">Date</th>
            <th class="p-2 border border-gray-700">Product</th>
            <th class="p-2 border border-gray-700">Debit</th>
            <th class="p-2 border border-gray-700">For</th>
            <th class="p-2 border border-gray-700">Quantity</th>
            <th class="p-2 border border-gray-700">By</th>
            <th class="p-2 border border-gray-700">From</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td class="p-2 border border-gray-700">${row.date || row[1] || ""}</td>
              <td class="p-2 border border-gray-700">${row.product || row[5] || ""}</td>
              <td class="p-2 border border-gray-700">${row.debit || row[4] || ""}</td>
              <td class="p-2 border border-gray-700">${row.for || row[6] || ""}</td>
              <td class="p-2 border border-gray-700">${row.quantity || row[7] || ""}</td>
              <td class="p-2 border border-gray-700">${row.by || row[8] || ""}</td>
              <td class="p-2 border border-gray-700">${row.from || row[9] || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } else {
    html = "<p class='mt-4 text-red-400'>No records found</p>";
  }
  document.getElementById("searchResults").innerHTML = html;
}

// 🔹 Search product (online + offline)
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!query) return alert("Please enter a product name!");

  if (!navigator.onLine) {
    // Offline search
    let all = JSON.parse(localStorage.getItem("allEntries")) || [];
    let filtered = all.filter(entry => entry.product && entry.product.toLowerCase().includes(query));
    return showResults(filtered);
  }

  // Online search
  try {
    const res = await fetch(`${scriptURL}?search=${encodeURIComponent(query)}`);
    const result = await res.json();
    showResults(result.data || []);
  } catch (err) {
    console.error("❌ Search error:", err);
    alert("Error fetching search results!");
  }
}

// 🔹 Load on startup
window.addEventListener("load", () => {
  syncOfflineData();

  // load suggestions
  loadSuggestions("product", "productList");
  loadSuggestions("for", "forList");
  loadSuggestions("by", "byList");
  loadSuggestions("from", "fromList");

  // set current date
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("dateInput").value = today;
});

// 🔹 Auto sync when back online
window.addEventListener("online", syncOfflineData);
