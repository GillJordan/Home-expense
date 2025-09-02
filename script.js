const apiURL = "/.netlify/functions/addExpense";

// ✅ Form Submit
document.getElementById("dataForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

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
      loadSuggestions();

      // 🔹 Add new row instantly in Daily Data without reload
      appendDailyRow(result.row);

    } else {
      alert("❌ Error: " + JSON.stringify(result));
    }
  } catch (err) {
    console.error("❌ Submit error:", err);
    alert("Error submitting data!");
  }
});

// ✅ Suggestions Loader
async function loadSuggestions() {
  try {
    const res = await fetch(`${apiURL}?suggestions=true`);
    const result = await res.json();
    if (result.data) {
      localStorage.setItem("suggestions", JSON.stringify(result.data));
      fillSuggestions(result.data);
    }
  } catch (err) {
    console.warn("⚠️ Offline mode, using cached suggestions");
    const cached = localStorage.getItem("suggestions");
    if (cached) fillSuggestions(JSON.parse(cached));
  }
}

function fillSuggestions(data) {
  const fillList = (id, arr) => {
    const unique = [...new Set(arr)].filter(Boolean);
    document.getElementById(id).innerHTML = unique.map(val => `<option value="${val}">`).join("");
  };
  fillList("productList", data.products || []);
  fillList("forList", data.forList || []);
  fillList("byList", data.byList || []);
  fillList("fromList", data.fromList || []);
}

window.addEventListener("load", loadSuggestions);

// ✅ Daily Data Loader
async function loadDailyData(date) {
  try {
    const res = await fetch(`${apiURL}?daily=true&date=${date}`);
    const result = await res.json();
    renderDailyTable(result.data);
  } catch (err) {
    console.error("❌ Daily data error:", err);
  }
}

// ✅ Append single row (instant update)
function appendDailyRow(row) {
  let table = document.querySelector("#dailyData table tbody");
  if (!table) {
    document.getElementById("dailyData").innerHTML = `
      <table class="w-full text-left border border-gray-600 mt-4">
        <thead>
          <tr class="bg-gray-800">
            <th class="p-2 border">Date</th>
            <th class="p-2 border">Product</th>
            <th class="p-2 border">Debit</th>
            <th class="p-2 border">For</th>
            <th class="p-2 border">By</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <p id="dailyTotal" class="mt-4 font-bold text-green-400"></p>
    `;
    table = document.querySelector("#dailyData table tbody");
  }

  table.innerHTML += `
    <tr>
      <td class="p-2 border">${row[1]}</td>
      <td class="p-2 border">${row[5]}</td>
      <td class="p-2 border">${row[4]}</td>
      <td class="p-2 border">${row[6]}</td>
      <td class="p-2 border">${row[8]}</td>
    </tr>`;

  updateDailyTotal();
}

// ✅ Render full daily table
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
            <th class="p-2 border">By</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            let debit = parseFloat(r[4] || 0);
            totalDebit += isNaN(debit) ? 0 : debit;
            return `
              <tr>
                <td class="p-2 border">${r[1]}</td>
                <td class="p-2 border">${r[5]}</td>
                <td class="p-2 border">${r[4]}</td>
                <td class="p-2 border">${r[6]}</td>
                <td class="p-2 border">${r[8]}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p id="dailyTotal" class="mt-4 font-bold text-green-400">Total Debit Today: ${totalDebit}</p>
    `;
  } else {
    html = "<p class='text-gray-400'>No data for today</p>";
  }

  document.getElementById("dailyData").innerHTML = html;
}

// ✅ Update daily total (after instant row append)
function updateDailyTotal() {
  const rows = document.querySelectorAll("#dailyData table tbody tr");
  let total = 0;
  rows.forEach(r => {
    const val = parseFloat(r.children[2].textContent || 0);
    total += isNaN(val) ? 0 : val;
  });
  const totalElem = document.getElementById("dailyTotal");
  if (totalElem) totalElem.textContent = `Total Debit Today: ${total}`;
}
