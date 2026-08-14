# CustomerPulse

CustomerPulse is a customer retention intelligence product for turning customer data into prioritized churn-risk actions.

The current version ships as an integrated FastAPI + React application with a retained trained model artifact for local scoring, upload validation, lead capture, action approvals, and feedback tracking.

## What It Does

- Upload customer CSV/XLSX files and calculate real churn probabilities with the saved model.
- Create new calculated customer entries from uploads.
- Rank customers by churn risk, urgency, monthly value, and estimated revenue at risk.
- Review individual customer explanations and recommended retention actions.
- Approve, modify, or reject retention actions.
- Capture retained, churned, or monitoring feedback outcomes.
- Capture landing-page leads through the backend.

## Tech Stack

- Python
- FastAPI
- Scikit-learn
- Pandas
- Joblib
- React
- TypeScript
- Vite
- Recharts
- GSAP

## Project Structure

```text
.
├── backend/
│   └── main.py                  # FastAPI API for model scoring, customers, actions, feedback, leads
├── frontend/
│   ├── public/images/peeps/     # Animated crowd sprite asset
│   └── src/                     # React product app and landing page
├── best_mlp.pkl                 # Saved churn model pipeline used by the API
├── X_test.csv                   # Model-compatible sample/schema data
├── requirements.txt             # Python dependencies
└── README.md
```

Runtime files such as uploaded customers, action state, feedback, leads, frontend builds, screenshots, and node modules are ignored by Git.

## Run Locally

### 1. Backend

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Backend runs at:

```text
http://127.0.0.1:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://127.0.0.1:5173
```

The landing page is at `/`.

The product app is at `/app`.

## Build Frontend

```bash
cd frontend
npm run build
```

## API Highlights

- `GET /summary`
- `GET /customers`
- `GET /customers/{customer_id}`
- `POST /customers/{customer_id}/decision`
- `POST /customers/{customer_id}/feedback`
- `POST /predict-upload`
- `POST /leads`
- `GET /analytics`
- `GET /model-intelligence`

## Provenance

CustomerPulse is the product application layer: the landing page, React workspace, FastAPI routes, upload workflow, customer queue, decision system, lead capture, and feedback loop.

The current repository still uses a retained churn model artifact (`best_mlp.pkl`) and compatible sample/schema file (`X_test.csv`) from the original Churn_Radar work so the product can run without retraining. Replace these artifacts with your own trained model and schema data when you are ready to make the machine learning layer fully original.
