import os
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error

CSV_PATH = os.path.join(os.path.dirname(__file__), "youtube_views.csv")

DEFAULT_DATA = {
    "Day": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    "Views": [120, 185, 260, 340, 410, 505, 560, 655, 720, 810, 890, 960, 1080, 1150, 1230]
}

def init_csv(force=False):
    """Initializes the CSV file with default data if it doesn't exist or force=True."""
    if force or not os.path.exists(CSV_PATH):
        df = pd.DataFrame(DEFAULT_DATA)
        df.to_csv(CSV_PATH, index=False)
        print(f"CSV initialized at {CSV_PATH}")

class YouTubePredictor:
    def __init__(self):
        init_csv()
        self.model = LinearRegression()
        self.df = None
        self.r2 = 0.0
        self.mse = 0.0
        self.slope = 0.0
        self.intercept = 0.0
        self.train_model()

    def train_model(self):
        """Loads data from CSV and trains the Linear Regression model."""
        self.df = pd.read_csv(CSV_PATH)
        # Sort by Day to ensure correct plots
        self.df = self.df.sort_values(by="Day").reset_index(drop=True)
        
        if len(self.df) < 2:
            # Not enough points to train, reset to default to avoid crash
            init_csv(force=True)
            self.df = pd.read_csv(CSV_PATH)

        X = self.df[["Day"]]
        y = self.df["Views"]

        # Train model
        self.model.fit(X, y)
        
        # Calculate training metrics
        predictions = self.model.predict(X)
        self.r2 = float(r2_score(y, predictions))
        self.mse = float(mean_squared_error(y, predictions))
        self.slope = float(self.model.coef_[0])
        self.intercept = float(self.model.intercept_)

    def get_data(self):
        """Returns the current dataset and the regression line points."""
        days = self.df["Day"].tolist()
        views = self.df["Views"].tolist()
        
        # Calculate regression line starting from min day to max day (or a bit beyond)
        min_day = min(days) if days else 1
        max_day = max(days) if days else 20
        
        # We can generate regression line data points for every actual day in our dataset
        # plus predictions for drawing a straight line.
        # Since it's a straight line, we only need the start and end coordinates to plot a line,
        # but returning it for all current days makes it easy to plot in Chart.js alongside the scatter data.
        line_days = sorted(list(set(days + [min_day, max_day])))
        line_preds = self.model.predict(pd.DataFrame({"Day": line_days})).tolist()
        
        return {
            "dataset": [{"day": d, "views": v} for d, v in zip(days, views)],
            "regression_line": [{"day": d, "views": p} for d, p in zip(line_days, line_preds)],
            "metrics": {
                "r2_score": self.r2,
                "mse": self.mse,
                "slope": self.slope,
                "intercept": self.intercept
            }
        }

    def predict_day(self, day: float):
        """Predicts views for a given day."""
        pred = self.model.predict(pd.DataFrame({"Day": [day]}))[0]
        return float(pred)

    def add_data_point(self, day: int, views: int):
        """Adds a single data point, saves to CSV, and retrains the model."""
        # Check if day already exists, if so we update it. Otherwise append.
        df_temp = pd.read_csv(CSV_PATH)
        if day in df_temp["Day"].values:
            df_temp.loc[df_temp["Day"] == day, "Views"] = views
        else:
            new_row = pd.DataFrame({"Day": [day], "Views": [views]})
            df_temp = pd.concat([df_temp, new_row], ignore_index=True)
            
        df_temp.to_csv(CSV_PATH, index=False)
        self.train_model()

    def delete_data_point(self, day: int):
        """Deletes a data point from the CSV dataset and retrains the model."""
        df_temp = pd.read_csv(CSV_PATH)
        df_temp = df_temp[df_temp["Day"] != day]
        df_temp.to_csv(CSV_PATH, index=False)
        self.train_model()

    def reset_data(self):
        """Resets CSV back to defaults and retrains."""
        init_csv(force=True)
        self.train_model()

    def import_csv_data(self, csv_text: str):
        """Parses CSV text, validates the columns (must have 'Day' and 'Views'), and saves to CSV_PATH."""
        import io
        try:
            # Clean up leading/trailing whitespaces and empty lines
            cleaned_lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]
            cleaned_csv = "\n".join(cleaned_lines)
            df_temp = pd.read_csv(io.StringIO(cleaned_csv))
        except Exception as e:
            raise ValueError(f"Invalid CSV format: {str(e)}")
        
        # Normalize columns: make them case-insensitive and trim spaces
        df_temp.columns = [c.strip() for c in df_temp.columns]
        df_cols_lower = {c.lower(): c for c in df_temp.columns}
        
        if "day" not in df_cols_lower or "views" not in df_cols_lower:
            raise ValueError("CSV must contain 'Day' and 'Views' columns.")
        
        # Rename to standardized names
        df_temp = df_temp.rename(columns={
            df_cols_lower["day"]: "Day",
            df_cols_lower["views"]: "Views"
        })
        
        # Convert columns to numeric, drop rows with NaN values
        try:
            df_temp["Day"] = pd.to_numeric(df_temp["Day"])
            df_temp["Views"] = pd.to_numeric(df_temp["Views"])
        except Exception:
            raise ValueError("Columns 'Day' and 'Views' must contain numeric values.")
            
        df_temp = df_temp.dropna(subset=["Day", "Views"])
        
        if len(df_temp) < 2:
            raise ValueError("Dataset must contain at least 2 valid numeric data points to train a linear model.")
            
        # Overwrite the CSV and retrain
        df_temp.to_csv(CSV_PATH, index=False)
        self.train_model()

# Self-test block to verify execution works
if __name__ == "__main__":
    predictor = YouTubePredictor()
    print("Initial prediction for Day 20:", predictor.predict_day(20))
    print("Metrics:", predictor.get_data()["metrics"])
