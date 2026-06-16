// State variables
let chartInstance = null;
let currentDataset = [];
let regressionLine = [];
let modelMetrics = {};
let currentPrediction = { day: 20, views: null };

// API URL (Relative to serve from same origin)
const API_BASE = "";

// DOM Elements
const r2ValueEl = document.getElementById("r2Value");
const equationValueEl = document.getElementById("equationValue");
const mseValueEl = document.getElementById("mseValue");
const predictDaySlider = document.getElementById("predictDaySlider");
const predictDayInput = document.getElementById("predictDayInput");
const predictedViewsEl = document.getElementById("predictedViews");
const addDataForm = document.getElementById("addDataForm");
const newDayInput = document.getElementById("newDay");
const newViewsInput = document.getElementById("newViews");
const datasetTableBody = document.querySelector("#datasetTable tbody");
const tableCountEl = document.getElementById("tableCount");
const resetBtn = document.getElementById("resetBtn");

// Bulk feed DOM Elements
const tabPasteBtn = document.getElementById("tabPasteBtn");
const tabUploadBtn = document.getElementById("tabUploadBtn");
const sectionPaste = document.getElementById("sectionPaste");
const sectionUpload = document.getElementById("sectionUpload");
const feedDatasetForm = document.getElementById("feedDatasetForm");
const csvTextInput = document.getElementById("csvTextInput");
const csvFileInput = document.getElementById("csvFileInput");
const dropZone = document.getElementById("dropZone");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const fileNameText = document.getElementById("fileNameText");
const clearFileBtn = document.getElementById("clearFileBtn");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    setupEventListeners();
});

// Setup event listeners for user interactions
function setupEventListeners() {
    // Sync slider and input
    predictDaySlider.addEventListener("input", (e) => {
        predictDayInput.value = e.target.value;
        runPrediction(parseFloat(e.target.value));
    });

    predictDayInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 1) {
            predictDaySlider.value = Math.min(val, 50); // limit slider display max
            runPrediction(val);
        }
    });

    // Submit new data point
    addDataForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const day = parseInt(newDayInput.value);
        const views = parseInt(newViewsInput.value);

        if (isNaN(day) || isNaN(views)) return;

        try {
            const response = await fetch(`${API_BASE}/api/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ day, views })
            });

            if (response.ok) {
                const data = await response.json();
                updateAppState(data);
                newDayInput.value = "";
                newViewsInput.value = "";
                
                // Re-run prediction for the currently selected day
                runPrediction(parseFloat(predictDayInput.value));
            } else {
                const err = await response.json();
                alert(`Error retraining model: ${err.detail || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Error submitting data:", error);
        }
    });

    // Reset data
    resetBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to reset the dataset to default values?")) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/reset`, { method: "POST" });
            if (response.ok) {
                const data = await response.json();
                updateAppState(data);
                runPrediction(parseFloat(predictDayInput.value));
            }
        } catch (error) {
            console.error("Error resetting data:", error);
        }
    });

    // Tab switching logic
    tabPasteBtn.addEventListener("click", () => {
        tabPasteBtn.classList.add("active");
        tabUploadBtn.classList.remove("active");
        sectionPaste.classList.remove("hidden");
        sectionUpload.classList.add("hidden");
    });

    tabUploadBtn.addEventListener("click", () => {
        tabUploadBtn.classList.add("active");
        tabPasteBtn.classList.remove("active");
        sectionUpload.classList.remove("hidden");
        sectionPaste.classList.add("hidden");
    });

    // File input selection handling
    csvFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameText.textContent = file.name;
            fileNameDisplay.classList.remove("hidden");
        } else {
            fileNameDisplay.classList.add("hidden");
        }
    });

    // Clear file selection
    clearFileBtn.addEventListener("click", () => {
        csvFileInput.value = "";
        fileNameDisplay.classList.add("hidden");
    });

    // Drag and drop event handling
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            csvFileInput.files = files;
            // trigger change manually
            const event = new Event('change');
            csvFileInput.dispatchEvent(event);
        }
    });

    // Submit bulk feed dataset
    feedDatasetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const isPasteMode = tabPasteBtn.classList.contains("active");
        
        if (isPasteMode) {
            const csvText = csvTextInput.value.trim();
            if (!csvText) {
                alert("Please paste some CSV data first.");
                return;
            }
            await submitBulkData(csvText);
        } else {
            const file = csvFileInput.files[0];
            if (!file) {
                alert("Please select or drop a CSV file first.");
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const csvText = event.target.result;
                await submitBulkData(csvText);
            };
            reader.onerror = () => {
                alert("Failed to read the file.");
            };
            reader.readAsText(file);
        }
    });
}

// Submit bulk CSV data to backend
async function submitBulkData(csvText) {
    try {
        const response = await fetch(`${API_BASE}/api/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csv_data: csvText })
        });

        if (response.ok) {
            const data = await response.json();
            updateAppState(data);
            
            // Clear paste text area
            csvTextInput.value = "";
            // Clear file input
            csvFileInput.value = "";
            fileNameDisplay.classList.add("hidden");
            
            // Re-run prediction
            runPrediction(parseFloat(predictDayInput.value));
        } else {
            const err = await response.json();
            alert(`Error importing dataset: ${err.detail || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Error submitting bulk data:", error);
        alert("Failed to connect to the server.");
    }
}

// Fetch all initial data from backend
async function fetchData() {
    try {
        const response = await fetch(`${API_BASE}/api/data`);
        if (response.ok) {
            const data = await response.json();
            updateAppState(data);
            runPrediction(parseFloat(predictDayInput.value));
        } else {
            console.error("API error loading data:", response.statusText);
        }
    } catch (error) {
        console.error("Failed to fetch data:", error);
    }
}

// Predict views for a specific day
async function runPrediction(day) {
    if (isNaN(day)) return;
    try {
        const response = await fetch(`${API_BASE}/api/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day })
        });

        if (response.ok) {
            const result = await response.json();
            currentPrediction = { day: result.day, views: result.predicted_views };
            
            // Format number nicely
            predictedViewsEl.textContent = Math.round(result.predicted_views).toLocaleString();
            
            // Refresh chart to update prediction point
            updateChart();
        }
    } catch (error) {
        console.error("Prediction error:", error);
    }
}

// Delete a specific data point
async function deleteDataPoint(day) {
    if (!confirm(`Remove Day ${day} from training data?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/data/${day}`, {
            method: "DELETE"
        });

        if (response.ok) {
            const data = await response.json();
            updateAppState(data);
            runPrediction(parseFloat(predictDayInput.value));
        } else {
            const err = await response.json();
            alert(`Error deleting point: ${err.detail || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Error deleting point:", error);
    }
}

// Update the local state & metrics UI
function updateAppState(data) {
    currentDataset = data.dataset;
    regressionLine = data.regression_line;
    modelMetrics = data.metrics;

    // Update metrics UI
    r2ValueEl.textContent = `${(modelMetrics.r2_score * 100).toFixed(2)}%`;
    
    const sign = modelMetrics.intercept >= 0 ? "+" : "-";
    const absIntercept = Math.abs(modelMetrics.intercept).toFixed(2);
    equationValueEl.textContent = `y = ${modelMetrics.slope.toFixed(2)}x ${sign} ${absIntercept}`;
    
    mseValueEl.textContent = Math.round(modelMetrics.mse).toLocaleString();

    // Render table
    renderTable();

    // Render/Update Chart
    updateChart();
}

// Render raw data table
function renderTable() {
    datasetTableBody.innerHTML = "";
    tableCountEl.textContent = `${currentDataset.length} rows`;

    currentDataset.forEach(row => {
        const tr = document.createElement("tr");
        
        const tdDay = document.createElement("td");
        tdDay.textContent = row.day;
        
        const tdViews = document.createElement("td");
        tdViews.textContent = row.views.toLocaleString();
        
        const tdAction = document.createElement("td");
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger";
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.title = "Delete data point";
        deleteBtn.addEventListener("click", () => deleteDataPoint(row.day));
        tdAction.appendChild(deleteBtn);
        
        tr.appendChild(tdDay);
        tr.appendChild(tdViews);
        tr.appendChild(tdAction);
        
        datasetTableBody.appendChild(tr);
    });
}

// Draw and update Chart.js instance
function updateChart() {
    const ctx = document.getElementById("regressionChart").getContext("2d");

    // Format datasets for Chart.js
    const actualPoints = currentDataset.map(pt => ({ x: pt.day, y: pt.views }));
    const linePoints = regressionLine.map(pt => ({ x: pt.day, y: pt.views }));
    const predPoint = currentPrediction.views !== null ? [{ x: currentPrediction.day, y: currentPrediction.views }] : [];

    if (chartInstance) {
        // Update data in existing chart
        chartInstance.data.datasets[0].data = actualPoints;
        chartInstance.data.datasets[1].data = linePoints;
        chartInstance.data.datasets[2].data = predPoint;
        chartInstance.update();
    } else {
        // Create chart configuration
        chartInstance = new Chart(ctx, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Actual Views",
                        data: actualPoints,
                        backgroundColor: "#00f5d4",
                        borderColor: "#00f5d4",
                        borderWidth: 1,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        showLine: false
                    },
                    {
                        label: "Regression Line",
                        data: linePoints,
                        type: "line",
                        borderColor: "#9d4edd",
                        borderWidth: 3,
                        pointRadius: 0, // hide line point dots
                        fill: false,
                        tension: 0, // keep it perfectly straight
                        showLine: true
                    },
                    {
                        label: `Prediction (Day ${currentPrediction.day})`,
                        data: predPoint,
                        backgroundColor: "#e63946",
                        borderColor: "#ffffff",
                        borderWidth: 2,
                        pointRadius: 9,
                        pointHoverRadius: 11,
                        pointStyle: "rectRot", // rotated rectangle/diamond looks super premium!
                        showLine: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            color: "#f3f1fe",
                            font: {
                                family: "Outfit",
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Day ${context.parsed.x}: ${Math.round(context.parsed.y).toLocaleString()} views`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: "linear",
                        title: {
                            display: true,
                            text: "Day",
                            color: "#9f9bbd",
                            font: { family: "Outfit", size: 13, weight: "bold" }
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.05)"
                        },
                        ticks: {
                            color: "#9f9bbd",
                            font: { family: "Outfit" }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Views",
                            color: "#9f9bbd",
                            font: { family: "Outfit", size: 13, weight: "bold" }
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.05)"
                        },
                        ticks: {
                            color: "#9f9bbd",
                            font: { family: "Outfit" }
                        }
                    }
                }
            }
        });
    }
}
