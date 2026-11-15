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

def is_deadline_expired(data: dict) -> bool:
    now_utc = datetime.now(timezone.utc)
    now_local = datetime.now()

    # 1. expires_at field
    expires_at = data.get("expires_at")
    if hasattr(expires_at, "to_datetime"):
        expires_at = expires_at.to_datetime()
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is not None:
            if expires_at < now_utc:
                return True
        else:
            if expires_at < now_local:
                return True

    # 2. safe_hours + created_at
    safe_hours = data.get("safe_hours")
    created_at = data.get("created_at")
    if hasattr(created_at, "to_datetime"):
        created_at = created_at.to_datetime()
    if safe_hours is not None and isinstance(created_at, datetime):
        try:
            sh = float(safe_hours)
            cutoff = created_at + timedelta(hours=sh)
            if cutoff.tzinfo is not None:
                if cutoff < now_utc:
                    return True
            else:
                if cutoff < now_local:
                    return True
        except (ValueError, TypeError):
            pass

    # 3. pickup_deadline / pickupDeadline / deadline
    raw_dl = data.get("pickup_deadline") or data.get("pickupDeadline") or data.get("deadline")
    if hasattr(raw_dl, "to_datetime"):
        raw_dl = raw_dl.to_datetime()
    if isinstance(raw_dl, datetime):
        if raw_dl.tzinfo is not None:
            if raw_dl < now_utc:
                return True
        else:
            if raw_dl < now_local:
                return True
    elif isinstance(raw_dl, str) and raw_dl.strip():
        s = raw_dl.strip()
        # ISO format
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is not None:
                if dt < now_utc:
                    return True
            else:
                if dt < now_local:
                    return True
            return False
        except Exception:
            pass

        # Formats with date
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
        ):
            try:
                dt = datetime.strptime(s, fmt)
                if dt < now_local:
                    return True
                return False
            except Exception:
                pass

        # Formats with time only
        clean_s = s.lower().replace("today", "").replace("by", "").replace("at", "").strip()
        for t_fmt in ("%I:%M %p", "%I:%M%p", "%H:%M"):
            try:
                t_val = datetime.strptime(clean_s, t_fmt).time()
                today_dt = datetime.combine(now_local.date(), t_val)
                if today_dt < now_local:
                    return True
                return False
            except Exception:
                pass

    return False

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
    listings = []
    for doc in docs:
        data = doc.to_dict()
        if not is_deadline_expired(data):
            listings.append({"id": doc.id, **data})
    return listings

def get_claimed_listings():
    docs = db.collection("listings").where("status", "==", "claimed").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

def get_picked_up_listings():
    docs = db.collection("listings").where("status", "==", "picked_up").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

def get_meals_rescued() -> int:
    docs = db.collection("listings").where("status", "==", "picked_up").stream()
    total = 0
    for d in docs:
        data = d.to_dict() or {}
        serv = data.get("servings")
        if serv is None:
            serv = data.get("est_servings")
        if serv is None:
            serv = data.get("serv", 0)
        try:
            total += int(serv)
        except (ValueError, TypeError):
            pass
    return total

@firestore.transactional
def _claim_transaction(transaction, doc_ref, receiver_name: str) -> int:
    snapshot = doc_ref.get(transaction=transaction)
    if not snapshot.exists:
        return 404
    data = snapshot.to_dict() or {}
    if data.get("status") != "available":
        return 409
    if is_deadline_expired(data):
        return 409
    now = datetime.now(timezone.utc)
    transaction.update(doc_ref, {
        "status": "claimed",
        "receiver_name": receiver_name,
        "claimed_by": receiver_name,
        "claimed_at": now,
        "claimedAt": now,
    })
    return 200

def claim_listing(listing_id: str, receiver_name: str = "Neighbor") -> int:
    doc_ref = db.collection("listings").document(listing_id)
    transaction = db.transaction()
    return _claim_transaction(transaction, doc_ref, receiver_name)

@firestore.transactional
def _cancel_pickup_transaction(transaction, doc_ref, claimed_at: datetime | None) -> int:
    snapshot = doc_ref.get(transaction=transaction)
    if not snapshot.exists:
        return 404
    data = snapshot.to_dict() or {}
    if data.get("status") != "claimed" or (data.get("claimed_at") or data.get("claimedAt")) != claimed_at:
        return 409

    transaction.update(doc_ref, {
        "status": "available",
        "receiver_name": firestore.DELETE_FIELD,
        "claimed_by": firestore.DELETE_FIELD,
        "claimed_at": firestore.DELETE_FIELD,
        "claimedAt": firestore.DELETE_FIELD,
    })
    return 200


def cancel_pickup_listing(listing_id: str, claimed_at: datetime | None) -> int:
    doc_ref = db.collection("listings").document(listing_id)
    return _cancel_pickup_transaction(db.transaction(), doc_ref, claimed_at)


@firestore.transactional
def _pickup_transaction(transaction, doc_ref) -> int:
    snapshot = doc_ref.get(transaction=transaction)
    if not snapshot.exists:
        return 404
    data = snapshot.to_dict() or {}
    status = data.get("status")
    if status != "claimed":
        return 409
    now = datetime.now(timezone.utc)
    transaction.update(doc_ref, {
        "status": "picked_up",
        "picked_up_at": now,
        "pickedUpAt": now,
    })
    return 200

def pickup_listing(listing_id: str) -> int:
    doc_ref = db.collection("listings").document(listing_id)
    transaction = db.transaction()
    return _pickup_transaction(transaction, doc_ref)
