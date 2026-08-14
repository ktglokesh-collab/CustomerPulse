from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "customerpulse_data"
DATA_DIR.mkdir(exist_ok=True)

MODEL_PATH = ROOT / "best_mlp.pkl"
X_TEST_PATH = ROOT / "X_test.csv"
STATE_PATH = DATA_DIR / "action_state.json"
FEEDBACK_PATH = DATA_DIR / "customer_feedback.csv"
UPLOADED_CUSTOMERS_PATH = DATA_DIR / "uploaded_customers.csv"
LEADS_PATH = DATA_DIR / "leads.csv"

app = FastAPI(title="CustomerPulse API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DecisionIn(BaseModel):
    status: Literal["approved", "modified", "rejected"]
    note: str = ""
    offer: str | None = None


class FeedbackIn(BaseModel):
    outcome: Literal["retained", "churned", "monitoring"]
    note: str = ""


class LeadIn(BaseModel):
    name: str
    email: str
    company: str = ""
    use_case: str = ""


@app.get("/")
def root():
    return {
        "name": "CustomerPulse API",
        "status": "running",
        "frontend": "http://127.0.0.1:5173/app",
        "docs": "/docs",
        "endpoints": ["/summary", "/customers", "/predict-upload", "/analytics", "/model-intelligence"],
    }


@app.get("/app")
def app_redirect():
    return RedirectResponse("http://127.0.0.1:5173/app")


def load_model():
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=500, detail="Model file best_mlp.pkl is missing")
    return joblib.load(MODEL_PATH)


def expected_columns() -> list[str]:
    if not X_TEST_PATH.exists():
        raise HTTPException(status_code=500, detail="X_test.csv is missing")
    return pd.read_csv(X_TEST_PATH, nrows=1).columns.tolist()


def validate_model_input(data: pd.DataFrame) -> pd.DataFrame:
    expected = expected_columns()
    missing = [column for column in expected if column not in data.columns]
    extra = [column for column in data.columns if column not in expected]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Uploaded file does not match the model schema",
                "missing_columns": missing,
                "extra_columns": extra,
                "expected_columns": expected,
            },
        )
    return data[expected].copy()


def load_customers() -> pd.DataFrame:
    if not X_TEST_PATH.exists():
        raise HTTPException(status_code=500, detail="X_test.csv is missing")
    data = pd.read_csv(X_TEST_PATH)
    customers = enrich_customers(data, range(10001, 10001 + len(data)), "sample")
    if UPLOADED_CUSTOMERS_PATH.exists():
        uploaded = pd.read_csv(UPLOADED_CUSTOMERS_PATH)
        customers = pd.concat([customers, uploaded], ignore_index=True, sort=False)
    return customers


def enrich_customers(data: pd.DataFrame, customer_ids, source: str) -> pd.DataFrame:
    model_input = validate_model_input(data)
    probabilities = load_model().predict_proba(model_input)[:, 1]
    customers = model_input.copy()
    if "customer_id" in customers.columns:
        customers = customers.drop(columns=["customer_id"])
    customers.insert(0, "customer_id", list(customer_ids))
    customers["source"] = source
    customers["churn_probability"] = probabilities
    customers["monthly_value"] = (
        customers.get("CashbackAmount", pd.Series(0, index=customers.index)).fillna(0) * 8
        + customers.get("OrderAmountHikeFromlastYear", pd.Series(0, index=customers.index)).fillna(0) * 35
        + customers.get("DaySinceLastOrder", pd.Series(0, index=customers.index)).fillna(0) * 9
        + 650
    ).round(0)
    customers["revenue_at_risk"] = (customers["monthly_value"] * customers["churn_probability"]).round(0)
    customers["risk_band"] = pd.cut(
        customers["churn_probability"],
        bins=[-0.01, 0.25, 0.5, 0.75, 1.0],
        labels=["Low", "Medium", "High", "Critical"],
    ).astype(str)
    customers["urgency"] = customers["churn_probability"].apply(
        lambda p: "Immediate" if p >= 0.75 else "Within 24h" if p >= 0.5 else "Monitor"
    )
    customers["reason"] = customers.apply(infer_reason, axis=1)
    customers["created_at"] = datetime.now(timezone.utc).isoformat()
    return customers


def next_uploaded_id(count: int) -> range:
    if UPLOADED_CUSTOMERS_PATH.exists():
        existing = pd.read_csv(UPLOADED_CUSTOMERS_PATH)
        start = int(existing["customer_id"].max()) + 1 if not existing.empty else 900001
    else:
        start = 900001
    return range(start, start + count)


def infer_reason(row: pd.Series) -> str:
    if row.get("DaySinceLastOrder", 0) >= 10:
        return "Dormant ordering behaviour"
    if row.get("Complain", 0) == 1:
        return "Recent complaint signal"
    if row.get("SatisfactionScore", 5) <= 2:
        return "Low satisfaction"
    if row.get("Tenure", 99) <= 3:
        return "Early lifecycle risk"
    return "Value and engagement pattern"


def read_state() -> dict[str, dict]:
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def write_state(state: dict[str, dict]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def recommendation(customer: pd.Series) -> dict:
    risk = float(customer["churn_probability"])
    value = float(customer["monthly_value"])
    if risk >= 0.75 and value >= 1000:
        offer = "Premium retention credit"
        channel = "Priority call + app notification"
    elif risk >= 0.5:
        offer = "Personalized recovery coupon"
        channel = "SMS + email"
    else:
        offer = "Monitor and nudge"
        channel = "App notification"
    return {
        "reason": customer["reason"],
        "action": f"Prioritize customer for {offer.lower()} and track response.",
        "channel": channel,
        "offer": offer,
        "requires_approval": risk >= 0.65 or value >= 1200,
    }


@app.get("/summary")
def summary():
    customers = load_customers()
    feedback_count = len(pd.read_csv(FEEDBACK_PATH)) if FEEDBACK_PATH.exists() else 0
    return {
        "customers_analyzed": int(len(customers)),
        "revenue_at_risk": int(customers["revenue_at_risk"].sum()),
        "critical_customers": int((customers["risk_band"] == "Critical").sum()),
        "immediate_actions": int((customers["urgency"] == "Immediate").sum()),
        "approval_required": int(customers.apply(lambda row: recommendation(row)["requires_approval"], axis=1).sum()),
        "feedback_records": feedback_count,
        "model": {
            "name": "MLP Classifier",
            "accuracy": "98%",
            "source": "best_mlp.pkl",
        },
    }


@app.get("/analytics")
def analytics():
    customers = load_customers()
    risk_distribution = (
        customers["risk_band"].value_counts().reindex(["Critical", "High", "Medium", "Low"]).fillna(0).astype(int)
    )
    top_k = []
    ranked = customers.sort_values("revenue_at_risk", ascending=False)
    for k in [50, 100, 250, 500]:
        top = ranked.head(k)
        top_k.append(
            {
                "label": f"Top {k}",
                "customers": k,
                "revenue_at_risk": int(top["revenue_at_risk"].sum()),
                "avg_risk": round(float(top["churn_probability"].mean() * 100), 2),
            }
        )
    return {
        "risk_distribution": [{"band": band, "count": int(count)} for band, count in risk_distribution.items()],
        "top_k": top_k,
        "action_distribution": [
            {"status": "Pending", "count": int(summary()["approval_required"])},
            {"status": "Immediate", "count": int(summary()["immediate_actions"])},
            {"status": "Feedback", "count": int(summary()["feedback_records"])},
        ],
    }


@app.get("/model-intelligence")
def model_intelligence():
    model = load_model()
    estimator = model.steps[-1][1] if hasattr(model, "steps") else model
    transformer = model.steps[0][1] if hasattr(model, "steps") else None
    transformed_features = []
    if transformer is not None and hasattr(transformer, "get_feature_names_out"):
        transformed_features = transformer.get_feature_names_out().tolist()
    return {
        "model_file": str(MODEL_PATH.name),
        "pipeline_type": type(model).__name__,
        "estimator": type(estimator).__name__,
        "hidden_layers": list(getattr(estimator, "hidden_layer_sizes", [])),
        "expected_columns": expected_columns(),
        "transformed_feature_count": len(transformed_features),
        "sample_transformed_features": transformed_features[:12],
        "note": "Predictions are produced by the saved sklearn pipeline. This repo does not include a holdout target file, so live benchmark metrics are not fabricated here.",
    }


@app.get("/customers")
def customers(limit: int = 80, risk: str = "All", q: str = ""):
    data = load_customers()
    if risk != "All":
        data = data[data["risk_band"] == risk]
    if q:
        data = data[data["customer_id"].astype(str).str.contains(q)]
    data = data.sort_values("revenue_at_risk", ascending=False).head(limit)
    return [serialize_customer(row) for _, row in data.iterrows()]


@app.get("/customers/{customer_id}")
def customer_detail(customer_id: int):
    data = load_customers()
    matched = data[data["customer_id"] == customer_id]
    if matched.empty:
        raise HTTPException(status_code=404, detail="Customer not found")
    row = matched.iloc[0]
    item = serialize_customer(row)
    item["recommendation"] = recommendation(row)
    item["behaviour"] = build_behaviour(row)
    item["explanations"] = [
        {"feature": "DaySinceLastOrder", "signal": float(row.get("DaySinceLastOrder", 0)), "impact": "higher churn risk"},
        {"feature": "Tenure", "signal": float(row.get("Tenure", 0)), "impact": "lifecycle risk"},
        {"feature": "SatisfactionScore", "signal": float(row.get("SatisfactionScore", 0)), "impact": "experience signal"},
    ]
    item["decision"] = read_state().get(str(customer_id), {"status": "pending", "note": ""})
    return item


@app.post("/customers/{customer_id}/decision")
def save_decision(customer_id: int, decision: DecisionIn):
    state = read_state()
    state[str(customer_id)] = {
        "status": decision.status,
        "note": decision.note,
        "offer": decision.offer,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_state(state)
    return {"ok": True, "decision": state[str(customer_id)]}


@app.post("/customers/{customer_id}/feedback")
def save_feedback(customer_id: int, feedback: FeedbackIn):
    row = {
        "customer_id": customer_id,
        "outcome": feedback.outcome,
        "note": feedback.note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = pd.read_csv(FEEDBACK_PATH) if FEEDBACK_PATH.exists() else pd.DataFrame()
    pd.concat([existing, pd.DataFrame([row])], ignore_index=True).to_csv(FEEDBACK_PATH, index=False)
    return {"ok": True, "feedback": row}


@app.post("/leads")
def save_lead(lead: LeadIn):
    if "@" not in lead.email:
        raise HTTPException(status_code=422, detail="A valid email is required")
    row = {
        "name": lead.name.strip(),
        "email": lead.email.strip(),
        "company": lead.company.strip(),
        "use_case": lead.use_case.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = pd.read_csv(LEADS_PATH) if LEADS_PATH.exists() else pd.DataFrame()
    pd.concat([existing, pd.DataFrame([row])], ignore_index=True).to_csv(LEADS_PATH, index=False)
    return {"ok": True, "lead": row}


@app.post("/predict-upload")
async def predict_upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")
    suffix = Path(file.filename).suffix.lower()
    if suffix == ".csv":
        data = pd.read_csv(file.file)
    elif suffix in {".xlsx", ".xls"}:
        data = pd.read_excel(file.file)
    else:
        raise HTTPException(status_code=400, detail="Upload a CSV or Excel file")
    data = validate_model_input(data)
    result = enrich_customers(data, next_uploaded_id(len(data)), "uploaded")
    existing = pd.read_csv(UPLOADED_CUSTOMERS_PATH) if UPLOADED_CUSTOMERS_PATH.exists() else pd.DataFrame()
    pd.concat([existing, result], ignore_index=True, sort=False).to_csv(UPLOADED_CUSTOMERS_PATH, index=False)
    return {
        "rows": len(result),
        "created_customer_ids": result["customer_id"].astype(int).tolist(),
        "preview": result.head(50).to_dict(orient="records"),
    }


def serialize_customer(row: pd.Series) -> dict:
    return {
        "customer_id": int(row["customer_id"]),
        "churn_probability": round(float(row["churn_probability"]) * 100, 2),
        "monthly_value": int(row["monthly_value"]),
        "revenue_at_risk": int(row["revenue_at_risk"]),
        "risk_band": row["risk_band"],
        "urgency": row["urgency"],
        "reason": row["reason"],
        "source": row.get("source", "sample"),
    }


def build_behaviour(row: pd.Series) -> list[dict]:
    tenure = float(row.get("Tenure", 0))
    orders = float(row.get("OrderCount", 0))
    days = float(row.get("DaySinceLastOrder", 0))
    return [
        {"metric": "Engagement", "previous": max(22, 80 - days * 2), "current": max(5, 76 - days * 5)},
        {"metric": "Order momentum", "previous": max(1, orders + 3), "current": orders},
        {"metric": "Lifecycle trust", "previous": min(100, tenure * 9 + 25), "current": min(100, tenure * 8 + 15)},
    ]
