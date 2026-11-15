from pathlib import Path
from typing import Optional, Union, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gemini_service import analyze, Listing
from db import save_listing, save_donor_listing, get_available_listings, claim_listing

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent

# Homepage and public asset routes
@app.get("/")
def serve_homepage():
    return FileResponse(BASE_DIR / "FreshLoop.html")

@app.get("/FreshLoop.html")
def serve_homepage_html():
    return FileResponse(BASE_DIR / "FreshLoop.html")

@app.get("/FreshLoop.css")
def serve_css():
    return FileResponse(BASE_DIR / "FreshLoop.css", media_type="text/css")

@app.get("/FreshLoop2.css")
def serve_css2():
    return FileResponse(BASE_DIR / "FreshLoop.css", media_type="text/css")

@app.get("/FreshLoop.js")
def serve_js():
    return FileResponse(BASE_DIR / "FreshLoop.js", media_type="application/javascript")

@app.get("/FreshLoop2.js")
def serve_js2():
    return FileResponse(BASE_DIR / "FreshLoop.js", media_type="application/javascript")


# Existing FastAPI routes
class NewListing(BaseModel):
    listing: Listing        # the (possibly edited) Gemini result
    donor_name: str
    lat: float
    lng: float

@app.post("/listings")
def create_listing(body: dict):
    # 1. Compatibility with legacy Gemini NewListing format
    if "listing" in body and "donor_name" in body:
        try:
            new_listing = NewListing(**body)
            listing_id = save_listing(new_listing.listing, new_listing.donor_name, new_listing.lat, new_listing.lng)
            return {"id": listing_id}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 2. Donor form fields validation
    title = body.get("title")
    if not title or not isinstance(title, str) or not title.strip():
        raise HTTPException(status_code=400, detail="Title is required and must not be empty.")

    raw_servings = body.get("servings")
    if raw_servings is None:
        raw_servings = body.get("serving_count")
    if raw_servings is None:
        raw_servings = body.get("serv")

    servings = None
    if raw_servings is not None and not isinstance(raw_servings, bool):
        if isinstance(raw_servings, int) and raw_servings > 0:
            servings = raw_servings
        elif isinstance(raw_servings, float) and raw_servings.is_integer() and raw_servings > 0:
            servings = int(raw_servings)
        elif isinstance(raw_servings, str) and raw_servings.strip().isdigit():
            n = int(raw_servings.strip())
            if n > 0:
                servings = n

    if servings is None:
        raise HTTPException(status_code=400, detail="Serving count is required and must be a positive whole number.")

    pickup_address = body.get("pickup_address") or body.get("pickupAddress") or body.get("addr") or body.get("address")
    if not pickup_address or not isinstance(pickup_address, str) or not pickup_address.strip():
        raise HTTPException(status_code=400, detail="Pickup address is required and must not be empty.")

    pickup_deadline = body.get("pickup_deadline") or body.get("pickupDeadline") or body.get("deadline")
    if not pickup_deadline or not isinstance(pickup_deadline, str) or not pickup_deadline.strip():
        raise HTTPException(status_code=400, detail="Pickup deadline is required and must not be empty.")

    donor_data = {
        "title": title.strip(),
        "servings": servings,
        "pickupAddress": pickup_address.strip(),
        "pickup_address": pickup_address.strip(),
        "pickupDeadline": pickup_deadline.strip(),
        "pickup_deadline": pickup_deadline.strip(),
        "deadline": pickup_deadline.strip(),
        "status": "available",
        "donor_name": body.get("donor_name") or "You",
        "desc": (body.get("desc") or body.get("description") or "").strip(),
    }
    if body.get("dietary_tags"):
        donor_data["dietary_tags"] = body["dietary_tags"]
    elif body.get("diet"):
        donor_data["dietary_tags"] = [body["diet"]]

    if body.get("img"):
        donor_data["img"] = body["img"]
    elif body.get("image"):
        donor_data["img"] = body["image"]

    try:
        listing_id = save_donor_listing(donor_data)
        return {"id": listing_id, "ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save listing: {str(e)}")

@app.get("/listings")
def list_listings():
    return get_available_listings()

@app.post("/listings/{listing_id}/claim")
def claim(listing_id: str, receiver_name: str):
    claim_listing(listing_id, receiver_name)
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
