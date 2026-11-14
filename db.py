import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

firebase_admin.initialize_app(credentials.Certificate(os.environ["FIREBASE_CREDENTIALS"]))
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

def get_available_listings():
    docs = db.collection("listings").where("status", "==", "available").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

def claim_listing(listing_id: str, receiver_name: str):
    db.collection("listings").document(listing_id).update(
        {"status": "claimed", "claimed_by": receiver_name}
    )