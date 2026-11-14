from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from gemini_service import analyze, load_listings, update_status

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
async def analyze_photo(file: UploadFile = File(...)):
    image_bytes = await file.read()
    if len(image_bytes) > 5_000_000:
        raise HTTPException(status_code=413, detail="Image too large (max 5 MB)")
    try:
        return analyze(image_bytes, mime_type=file.content_type or "image/jpeg")
    except RuntimeError:
        raise HTTPException(status_code=503, detail="AI service busy, try again")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])


@app.get("/listings")
def get_listings(status: str | None = None):
    records = load_listings()
    if status:
        records = [r for r in records if r["status"] == status]
    return records


@app.post("/listings/{listing_id}/claim")
def claim(listing_id: int, receiver_name: str):
    record = update_status(listing_id, "claimed", claimed_by=receiver_name)
    if not record:
        raise HTTPException(status_code=404, detail="Listing not found")
    return record