"""Entry point: python run.py"""
import uvicorn
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("RAILWAY_ENVIRONMENT") is None  # reload เฉพาะ local
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=reload)
