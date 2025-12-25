const form = document.getElementById("expenseForm");
const list = document.getElementById("expenseList");
const totalEl = document.getElementById("total");
const toggle = document.getElementById("themeToggle");
const download = document.getElementById("downloadPDF");
const ctx = document.getElementById("expenseChart");
const cancelEditBtn = document.getElementById("cancelEdit");

const dateInput = document.getElementById("date");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");

let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let editId = null;
let chart;
let lastDeleted = null;
let undoTimer = null;

/* ================= DARK MODE ================= */
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const savedTheme = localStorage.getItem("theme");
applyTheme(savedTheme || (prefersDark.matches ? "dark" : "light"));

function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  toggle.textContent = mode === "dark" ? "☀️" : "🌙";
}

toggle.onclick = () => {
  const mode = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("theme", mode);
  applyTheme(mode);
};

/* ================= FORM SUBMIT ================= */
form.addEventListener("submit", e => {
  e.preventDefault();

  if (!dateInput.value) return alert("Tanggal wajib diisi");
  if (!titleInput.value.trim()) return alert("Nama pengeluaran wajib diisi");
  if (amountInput.value <= 0) return alert("Nominal harus > 0");

  const data = {
    id: editId ?? Date.now(),
    date: dateInput.value,
    title: titleInput.value.trim(),
    amount: Number(amountInput.value)
  };

  if (editId) {
    expenses = expenses.map(x => x.id === editId ? data : x);
    resetEdit();
  } else {
    expenses.push(data);
  }

  form.reset();
  saveAndRender();
});

/* ================= RENDER LIST ================= */
function render() {
  list.innerHTML = "";
  let total = 0;

  expenses.forEach(e => {
    total += e.amount;
    const li = document.createElement("li");
    li.dataset.id = e.id;
    li.classList.toggle("editing", e.id === editId);

    li.innerHTML = `
      <div>
        <strong>${e.title}</strong><br>
        <small>${e.date}</small>
      </div>
      <div>
        <span>Rp ${e.amount.toLocaleString("id-ID")}</span>
        <button class="edit-btn">✏️</button>
        <button class="delete-btn">🗑️</button>
      </div>
    `;
    list.appendChild(li);
  });

  totalEl.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

/* ================= EDIT & DELETE ================= */
list.addEventListener("click", e => {
  const li = e.target.closest("li");
  if (!li) return;

  const id = Number(li.dataset.id);

  if (e.target.classList.contains("edit-btn")) {
    const data = expenses.find(x => x.id === id);
    if (!data) return;

    dateInput.value = data.date;
    titleInput.value = data.title;
    amountInput.value = data.amount;
    editId = id;
    cancelEditBtn.classList.remove("hidden");
    render();
  }

  if (e.target.classList.contains("delete-btn")) {
    const deleted = expenses.find(x => x.id === id);
    if (!deleted) return;

    if (confirm("Hapus data ini?")) {
      expenses = expenses.filter(x => x.id !== id);
      lastDeleted = deleted;
      saveAndRender();
      showUndo();
    }
  }
});

/* ================= BATAL EDIT ================= */
function resetEdit() {
  editId = null;
  cancelEditBtn.classList.add("hidden");
  render();
}
cancelEditBtn.onclick = resetEdit;

/* ================= UNDO DELETE ================= */
function showUndo() {
  if (undoTimer) clearTimeout(undoTimer);

  const box = document.createElement("div");
  box.id = "undoBox";
  box.innerHTML = `<span>Data dihapus</span><button>Undo</button>`;
  document.body.appendChild(box);

  box.querySelector("button").onclick = () => {
    expenses.push(lastDeleted);
    lastDeleted = null;
    box.remove();
    saveAndRender();
  };

  undoTimer = setTimeout(() => {
    box.remove();
    lastDeleted = null;
  }, 5000);
}

/* ================= CHART ================= */
function renderChart() {
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: expenses.map(e => e.title),
      datasets: [{ label: "Pengeluaran", data: expenses.map(e => e.amount) }]
    }
  });
}

/* ================= INVOICE FORMAL (SEMUA BULAN) ================= */
download.onclick = () => {
  if (expenses.length === 0) return alert("Belum ada data");

  const jsPDF = window.jspdf.jsPDF;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let y = 20;
  let grandTotal = 0;

  const today = new Date().toLocaleDateString("id-ID");
  const invoiceNo = "INV-" + Date.now();

  pdf.setFontSize(16);
  pdf.text("EXPENSE TRACKER", 14, y);
  y += 8;

  pdf.setFontSize(12);
  pdf.text("INVOICE PENGELUARAN", 14, y);
  y += 6;

  pdf.setFontSize(10);
  pdf.text("Invoice No : " + invoiceNo, 14, y);
  y += 5;
  pdf.text("Tanggal    : " + today, 14, y);
  y += 8;

  pdf.line(14, y, pageWidth - 14, y);
  y += 8;

  const grouped = expenses.reduce((acc, e) => {
    const key = e.date.slice(0, 7);
    acc[key] = acc[key] || [];
    acc[key].push(e);
    return acc;
  }, {});

  for (const month in grouped) {
    const monthName = new Date(month + "-01")
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
      .toUpperCase();

    let monthTotal = 0;

    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(12);
    pdf.text("BULAN : " + monthName, 14, y);
    y += 6;
    pdf.line(14, y, pageWidth - 14, y);
    y += 6;

    pdf.setFontSize(10);
    pdf.text("No", 14, y);
    pdf.text("Tanggal", 26, y);
    pdf.text("Deskripsi", 55, y);
    pdf.text("Nominal", pageWidth - 40, y);
    y += 6;

    pdf.line(14, y, pageWidth - 14, y);
    y += 6;

    grouped[month].forEach((e, i) => {
      if (y > pageHeight - 25) {
        pdf.addPage();
        y = 20;
      }

      const nominal = "Rp " + e.amount.toLocaleString("id-ID");
      const w = pdf.getTextWidth(nominal);

      pdf.text(String(i + 1), 14, y);
      pdf.text(e.date, 26, y);
      pdf.text(e.title, 55, y);
      pdf.text(nominal, pageWidth - 14 - w, y);

      monthTotal += e.amount;
      grandTotal += e.amount;
      y += 6;
    });

    y += 2;
    pdf.line(14, y, pageWidth - 14, y);
    y += 6;

    pdf.setFontSize(11);
    pdf.text(
      "Total " + monthName + " : Rp " + monthTotal.toLocaleString("id-ID"),
      14,
      y
    );
    y += 10;
  }

  pdf.line(14, y, pageWidth - 14, y);
  y += 8;

  pdf.setFontSize(13);
  pdf.text(
    "TOTAL KESELURUHAN : Rp " + grandTotal.toLocaleString("id-ID"),
    14,
    y
  );

  y += 20;
  pdf.setFontSize(9);
  pdf.text("Invoice ini dibuat otomatis oleh sistem.", 14, y);
  y += 12;
  pdf.text("Hormat Kami,", pageWidth - 60, y);
  y += 10;
  pdf.text("Expense Tracker App", pageWidth - 60, y);

  pdf.save("Invoice-Pengeluaran-Semua-Bulan.pdf");
};

/* ================= SAVE ================= */
function saveAndRender() {
  localStorage.setItem("expenses", JSON.stringify(expenses));
  render();
  renderChart();
}

saveAndRender();