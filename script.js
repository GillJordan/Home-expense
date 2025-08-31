document.getElementById("dataForm").addEventListener("submit", function(e){
  e.preventDefault();
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  fetch("/.netlify/functions/addExpense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(response => {
    if (response.result === "success") {
      alert("✅ Data submitted successfully!");
      this.reset();
    } else {
      alert("❌ Error: " + response.message);
    }
  })
  .catch(err => alert("❌ Fetch error: " + err));
});
