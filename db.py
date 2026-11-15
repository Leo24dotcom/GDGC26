import os
import json
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

if not firebase_admin._apps:
    cred_val = os.environ.get("FIREBASE_CREDENTIALS")
    if cred_val and os.path.exists(cred_val):
        firebase_admin.initialize_app(credentials.Certificate(cred_val))
    elif cred_val:
        try:
            cred_dict = json.loads(cred_val)
            firebase_admin.initialize_app(credentials.Certificate(cred_dict))
        except Exception:
            firebase_admin.initialize_app()
    else:
        local_key = os.path.join(os.path.dirname(__file__), "backend", "serviceAccountKey.json")
        if os.path.exists(local_key):
            firebase_admin.initialize_app(credentials.Certificate(local_key))
        else:
            try:
                firebase_admin.initialize_app()
            except Exception:
                pass

db = firestore.client()

def save_listing(listing, donor_name: str, lat: float, lng: float) -> str:
    now = datetime.now(timezone.utc)
    data = listing.model_dump()
    data.update({
        "donor_name": donor_name,
        "lat": lat,
        "lng": lng,
        "status": "available",                       # available -> claimed -> picked_up
        "created_at": now,
        "expires_at": now + timedelta(hours=listing.safe_hours),
    })
    _, ref = db.collection("listings").add(data)
    return ref.id

def save_donor_listing(data: dict) -> str:
    now = datetime.now(timezone.utc)
    doc_data = {
        "status": "available",
        "created_at": now,
        **data,
    }
    _, ref = db.collection("listings").add(doc_data)
    return ref.id

def get_available_listings():
    docs = db.collection("listings").where("status", "==", "available").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

def claim_listing(listing_id: str, receiver_name: str):
    db.collection("listings").document(listing_id).update(
        {"status": "claimed", "claimed_by": receiver_name}
    )
