const scriptURL = "/.netlify/functions/addExpense";

// 🔹 Fetch suggestions from Google Sheet
async function fetchSuggestions() {
  try {
    const res = await fetch(`${scriptURL}?suggestions=true`);
    const result = await res.json();

    if (result.result === "success") {
      const rows = result.data;

      const productList = new Set();
      const forList = new Set();
      const byList = new Set();
      const fromList = new Set();

      rows.forEach(row => {
        if (row[0]) productList.add(row[0]);
        if (row[1]) forList.add(row[1]);
        if (row[2]) byList.add(row[2]);
        if (row[3]) fromList.add(row[3]);
      });

      loadSuggestionsFromSet(productList, "productList");
      loadSuggestionsFromSet(forList, "forList");
      loadSuggestionsFromSet(byList, "byList");
      loadSuggestionsFromSet(fromList, "fromList");
    }
  } catch (err) {
    console.error("❌ Suggestion fetch error:", err);
  }
}

function loadSuggestionsFromSet(set, datalistId) {
  let datalist = document.getElementById(datalistId);
  datalist.innerHTML = "";
  set.forEach(item => {
    let option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
}

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

// 🔹 Sync pending data
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
        saveEntryLocal(pending[i]);
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

// 🔹 Form submit
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
      saveEntryLocal(data);
      await fetchSuggestions(); // refresh suggestions live
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    saveOffline(data);
  }
});

// 🔹 Search
async function searchProduct() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!query) return alert("Please enter a product name!");

  if (!navigator.onLine) {
    let all = JSON.parse(localStorage.getItem("allEntries")) || [];
    let filtered = all.filter(entry => entry.product && entry.product.toLowerCase().includes(query));
    return showResults(filtered);
  }

  try {
    const res = await fetch(`${scriptURL}?search=${encodeURIComponent(query)}`);
    const result = await res.json();
    showResults(result.data || []);
  } catch (err) {
    console.error("❌ Search error:", err);
    alert("Error fetching search results!");
  }
}

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

// 🔹 Load on startup
window.addEventListener("load", async () => {
  syncOfflineData();
  await fetchSuggestions();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("dateInput").value = today;
});

window.addEventListener("online", syncOfflineData);
