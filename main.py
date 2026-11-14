from pydantic import BaseModel
from gemini_service import analyze, Listing
from db import save_listing, get_available_listings, claim_listing

class NewListing(BaseModel):
    listing: Listing        # the (possibly edited) Gemini result
    donor_name: str
    lat: float
    lng: float

@app.post("/listings")
def create_listing(body: NewListing):
    listing_id = save_listing(body.listing, body.donor_name, body.lat, body.lng)
    return {"id": listing_id}

@app.get("/listings")
def list_listings():
    return get_available_listings()

@app.post("/listings/{listing_id}/claim")
def claim(listing_id: str, receiver_name: str):
    claim_listing(listing_id, receiver_name)
    return {"ok": True}