from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gemini_service import analyze, Listing
from db import save_listing, get_available_listings, claim_listing

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
