import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Import our YouTubePredictor class
from backend.model import YouTubePredictor

app = FastAPI(
    title="YouTube Views Predictor API",
    description="Backend API for predicting YouTube views and retraining linear regression model.",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize predictor
try:
    predictor = YouTubePredictor()
except Exception as e:
    print(f"Failed to initialize predictor model: {e}")
    predictor = None

# Pydantic schemas for request validation
class PredictionRequest(BaseModel):
    day: float = Field(..., description="Day number to predict views for", ge=1, le=1000)

class DataPointRequest(BaseModel):
    day: int = Field(..., description="Day number", ge=1, le=1000)
    views: int = Field(..., description="View count", ge=0, le=1000000000)

class ImportRequest(BaseModel):
    csv_data: str = Field(..., description="Raw CSV string data to import")

@app.get("/api/data")
async def get_data():
    """Returns all data points, the calculated regression line, and model performance metrics."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        return predictor.get_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")

@app.post("/api/predict")
async def predict(request: PredictionRequest):
    """Predicts the number of views for a specific day."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        pred_views = predictor.predict_day(request.day)
        return {
            "day": request.day,
            "predicted_views": round(pred_views, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running prediction: {str(e)}")

@app.post("/api/data")
async def add_data(request: DataPointRequest):
    """Adds or updates a data point in the dataset and retrains the model."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        predictor.add_data_point(request.day, request.views)
        return predictor.get_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding data point: {str(e)}")

@app.post("/api/reset")
async def reset_data():
    """Resets the dataset to the default 15 days of data and retrains the model."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        predictor.reset_data()
        return predictor.get_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting data: {str(e)}")

@app.post("/api/import")
async def import_data(request: ImportRequest):
    """Imports bulk CSV data, replaces the dataset, and retrains the model."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        predictor.import_csv_data(request.csv_data)
        return predictor.get_data()
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing CSV data: {str(e)}")

@app.delete("/api/data/{day}")
async def delete_data(day: int):
    """Deletes a data point from the dataset and retrains the model."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Predictor model is not initialized.")
    try:
        predictor.delete_data_point(day)
        return predictor.get_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting data point: {str(e)}")

# Mount static files to serve the frontend (must be mounted at the end of definitions)
frontend_dir = os.path.join(os.path.dirname(__file__), "../frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"Warning: Frontend directory '{frontend_dir}' does not exist yet. Static mounting skipped.")
